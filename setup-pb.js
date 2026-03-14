const PB_URL = 'http://127.0.0.1:8090';

async function setup() {
    try {
        console.log('Authenticating as admin...');
        const authRes = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: 'admin@cloud.local', password: 'password1234' })
        });
        const authData = await authRes.json();
        if (!authRes.ok) throw new Error(authData.message || 'Auth failed');
        const token = authData.token;

        console.log('Creating folders collection...');
        const fRes = await fetch(`${PB_URL}/api/collections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': token },
            body: JSON.stringify({
                name: 'folders',
                type: 'base',
                listRule: '',
                viewRule: '',
                createRule: '',
                updateRule: '',
                deleteRule: '',
                schema: [
                    { name: 'name', type: 'text', required: true },
                    { name: 'parent', type: 'relation', options: { collectionId: '', maxSelect: 1, minSelect: null } },
                    { name: 'user_id', type: 'relation', required: true, options: { collectionId: '_pb_users_auth_', maxSelect: 1, minSelect: null } }
                ]
            })
        });
        console.log('Folders collection:', fRes.status);
        let foldersData = await fRes.json();
        let foldersColId = foldersData.id;

        console.log('Creating files collection...');
        const filesRes = await fetch(`${PB_URL}/api/collections`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': token },
            body: JSON.stringify({
                name: 'files',
                type: 'base',
                listRule: '',
                viewRule: '',
                createRule: '',
                updateRule: '',
                deleteRule: '',
                schema: [
                    { name: 'name', type: 'text', required: true },
                    { name: 'file', type: 'file', required: true, options: { maxSelect: 1, maxSize: 524288000 } },
                    { name: 'size', type: 'number' },
                    { name: 'folder_id', type: 'relation', options: { collectionId: foldersColId || '', maxSelect: 1, minSelect: null } },
                    { name: 'user_id', type: 'relation', required: true, options: { collectionId: '_pb_users_auth_', maxSelect: 1, minSelect: null } }
                ]
            })
        });
        console.log('Files collection:', filesRes.status);

        console.log('Setup finished.');
    } catch (e) {
        console.error('Setup failed', e.message);
    }
}

setup();
