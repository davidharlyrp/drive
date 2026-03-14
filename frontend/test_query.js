const PocketBase = require('pocketbase/cjs');
const pb = new PocketBase('http://127.0.0.1:8090');

async function test() {
    try {
        const users = await pb.collection('users').getFullList();
        const user = users[0];
        console.log('User ID:', user.id);

        try {
            const files = await pb.collection('files').getFullList({
                filter: `user_id = "${user.id}" && is_trash = false`,
                sort: '-created'
            });
            console.log('Success, files found:', files.length);
        } catch (e) {
            console.error('Files query error:', e.response);
        }
    } catch (e) {
        console.error('Users query error:', e.response);
    }
}
test();
