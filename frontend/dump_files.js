import fetch from 'node-fetch';

async function test() {
    try {
        // Authenticate as the user we created earlier or just try to auth as an admin
        // I'll auth as admin to read the schema
        const authRes = await fetch('http://127.0.0.1:8090/api/admins/auth-with-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identity: 'admin@cloudstore.com', password: 'adminpassword' }) // I will try default credentials if any, otherwise skip
        });

        // Let's just try to fetch a single file without filtering to see its structure
        const res = await fetch('http://127.0.0.1:8090/api/collections/files/records?perPage=1');
        const data = await res.json();
        console.log("Records sample:", JSON.stringify(data.items[0] || {}, null, 2));
    } catch (e) {
        console.error(e);
    }
}

test();
