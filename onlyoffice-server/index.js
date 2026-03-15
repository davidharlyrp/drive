const express = require('express');
const cors = require('cors');
const axios = require('axios');
const PocketBase = require('pocketbase/cjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const pb = new PocketBase(process.env.PB_URL);
pb.autoCancellation(false);

console.log('Target Integration URL:', process.env.INTEGRATION_SERVER_URL);

// Authenticate once at startup
async function initPB() {
    try {
        await pb.collection('_superusers').authWithPassword(process.env.PB_ADMIN_EMAIL, process.env.PB_ADMIN_PASSWORD);
        console.log('Connected to PocketBase as Superuser');
    } catch (error) {
        console.error('Failed to connect to PocketBase during startup:', error.message);
    }
}
initPB();

// Map extensions to OnlyOffice document types
const documentTypes = {
    // Word
    'docx': 'word', 'doc': 'word', 'docm': 'word', 'dot': 'word', 'dotm': 'word', 'dotx': 'word',
    'odt': 'word', 'ott': 'word', 'rtf': 'word', 'txt': 'word', 'html': 'word', 'htm': 'word',
    // Cell
    'xlsx': 'cell', 'xls': 'cell', 'xlsm': 'cell', 'xlt': 'cell', 'xltm': 'cell', 'xltx': 'cell',
    'csv': 'cell', 'ods': 'cell', 'ots': 'cell',
    // Slide
    'pptx': 'slide', 'ppt': 'slide', 'pptm': 'slide', 'pot': 'slide', 'potm': 'slide', 'potx': 'slide',
    'pps': 'slide', 'ppsm': 'slide', 'ppsx': 'slide', 'odp': 'slide', 'otp': 'slide'
};

app.get('/config/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;

        // Ensure we are still authenticated if token expired
        if (!pb.authStore.isValid) {
            await initPB();
        }

        const fileRecord = await pb.collection('files').getOne(fileId);
        const fileName = fileRecord.name;
        const extension = fileName.split('.').pop().toLowerCase();

        // Use the integration server as a proxy for the file download
        const fileUrl = `${process.env.INTEGRATION_SERVER_URL}/download/${fileId}`;
        const callbackUrl = `${process.env.INTEGRATION_SERVER_URL}/callback?fileId=${fileId}`;

        const config = {
            document: {
                key: (fileId + '-' + fileRecord.updated).replace(/[^0-9a-zA-Z._-]/g, '_'),
                title: fileName,
                url: fileUrl,
                permissions: {
                    download: true,
                    edit: true,
                    print: true,
                    review: true
                }
            },
            documentType: documentTypes[extension] || 'word',
            editorConfig: {
                callbackUrl: callbackUrl,
                mode: 'edit',
                user: {
                    id: req.query.userId || 'visitor',
                    name: req.query.userName || 'Guest Editor'
                },
                customization: {
                    autosave: true,
                    forcesave: true,
                    compactHeader: true,
                    toolbarNoTabs: false,
                    help: false,
                    compactToolbar: true
                }
            },
            documentServerUrl: process.env.ONLYOFFICE_SERVER_URL,
        };

        console.log(`Generating config for file: ${fileName} (${extension})`);

        // Add JWT token if secret is provided
        if (process.env.ONLYOFFICE_JWT_SECRET) {
            const token = jwt.sign(config, process.env.ONLYOFFICE_JWT_SECRET, { expiresIn: '1h' });
            config.token = token;
            console.log(`Generated JWT token for ${fileName}`);
        }

        res.json(config);
    } catch (error) {
        console.error('Config error details:', error.message || error);
        res.status(500).json({ error: 'Failed to generate config', details: error.message });
    }
});

// Proxy route to serve the file from PocketBase to OnlyOffice
app.get('/download/:fileId', async (req, res) => {
    try {
        const { fileId } = req.params;

        if (!pb.authStore.isValid) {
            await initPB();
        }

        const fileRecord = await pb.collection('files').getOne(fileId);
        const fileUrl = `${process.env.PB_URL}/api/files/${fileRecord.collectionId}/${fileRecord.id}/${fileRecord.file}`;

        console.log(`Proxying download for file: ${fileRecord.name}`);

        const response = await axios.get(fileUrl, { responseType: 'stream' });

        // Extension based MIME fallback
        const extensionToMime = {
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        };

        const extension = fileRecord.name.split('.').pop().toLowerCase();
        const contentType = extensionToMime[extension] || response.headers['content-type'] || 'application/octet-stream';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${fileRecord.name}"`);

        response.data.pipe(res);
    } catch (error) {
        console.error('Download proxy error:', error.message);
        res.status(500).send('Error downloading file');
    }
});

app.post('/callback', async (req, res) => {
    try {
        const { fileId } = req.query;
        const body = req.body;

        console.log(`\n--- CALLBACK RECEIVED ---`);
        console.log(`File ID: ${fileId}, Status: ${body.status}`);

        // Status 2: Document is ready for saving
        // Status 6: Document is ready for saving (editing finished)
        if (body.status === 2 || body.status === 6) {
            const downloadUrl = body.url;
            console.log('Action: Saving file to PocketBase...');

            const response = await axios.get(downloadUrl, { responseType: 'arraybuffer' });
            const fileRecord = await pb.collection('files').getOne(fileId);

            const formData = new FormData();
            const blob = new Blob([response.data]);
            formData.append('file', blob, fileRecord.name);

            await pb.collection('files').update(fileId, formData);
            console.log('SUCCESS: File updated in PocketBase');
        }

        res.json({ error: 0 }); // Tell OnlyOffice success
    } catch (error) {
        console.error('CALLBACK ERROR:', error.message);
        res.status(500).json({ error: 1 });
    }
});

app.listen(port, () => {
    console.log(`OnlyOffice Integration Server running on port ${port}`);
});
