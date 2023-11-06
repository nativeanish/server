interface _base {
    id: string;
    title: string;
    description: string;
    thumbnails: string;
    tags: Array<string>;
    access_model: "open" | "exclusive" | null;
    payment_address: string | null;
    price_winston: string | null;
    timestamp: string;
    creator: string;

}
interface Video extends _base {
    playlist: string | null;
    views: number;
    access_model: "open" | "exclusive" | null
}

interface Playlist extends _base {
    teaser: string;
    video_list: Array<string>;
    access_model: "open" | "exclusive"
}

interface User {
    id: string;
    video: Array<string>;
    playlist: Array<string>;
}

export interface State {
    video: Array<Video>
    playlist: Array<Playlist>
    user: Array<User>
    bought: Array<{ type: "video" | "playlist", id: string, user: string }>
    encrypted_db: Array<{ id: string, content_id: string, writer: string, iv: string }>
}
type call = "upload_video" | "create_playlist" | "view" | "get_playlist" | "get_video" | "buy" | "write_encryption_key" | "get_encryption_key" | "upload_teaser" | "upload_thumbnail" | "get_user"
export interface Action {
    input: {
        function: call
        id: string;
        title: string;
        description: string;
        thumbnails: string;
        tags: Array<string>;
        access_model: "open" | "exclusive";
        playlist: string;
        price_winston: string;
        teaser: string;
        type: "video" | "playlist";
        content_id: string;
        iv: string;
    }
}
export type _s_return = { state: State }
export type _q_return = { result: { success: boolean; data: Video | Playlist | string | User | { id: string, content_id: string, writer: string, iv: string } } }
export type _return = _s_return | _q_return