import PocketBase from 'pocketbase';

export const pb = new PocketBase('http://100.114.4.75:6001');
pb.autoCancellation(false);
