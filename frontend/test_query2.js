import PocketBase from 'pocketbase';
const pb = new PocketBase('http://127.0.0.1:8090');

async function test() {
    try {
        const authData = await pb.collection('users').authWithPassword('test@test.com', '12345678');
        const user = authData.record;
        console.log('User ID:', user.id);

        try {
            const files = await pb.collection('files').getFullList({
                filter: `user_id = "${user.id}" && is_trash = false`,
                sort: '-created'
            });
            console.log('Success, files found:', files.length);
        } catch (e) {
            console.error('Files query error:', JSON.stringify(e.response, null, 2));
        }
    } catch (e) {
        console.error('Users auth error:', e.message);
    }
}
test();
