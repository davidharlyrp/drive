const url = "http://127.0.0.1:8090/api/collections/files/records?filter=user_id+%3D+%22test_id%22+%26%26+is_trash+%3D+false&sort=-created";

fetch(url)
    .then(res => res.json())
    .then(data => console.log(data))
    .catch(console.error);
