import { NodeIrys } from "@irys/sdk";
import express from "express"
import { readFileSync } from "fs";
import crypto from "crypto"
import { WarpFactory } from "warp-contracts";
import Query from "@irys/query";
import axios from "axios";
import { Playlist, State } from "./types";
import Arweave from "arweave";
import cors from "cors"
const app = express()
app.use(cors())
app.use(express.json());
app.get("/", async (req, res) => {
    res.send("Bad Method")
})
const areave = Arweave.init({
    host: "65.1.2.24",
    port: 8080,
    protocol: "http"
})
const warp = WarpFactory.forLocal(8080, areave)
const wallet = (readFileSync("wallet.json", "utf-8"))
app.post("/upload", async (req, res) => {
    const data: { hash?: string, content_id?: string, key?: JsonWebKey, iv: string } = req.body
    if (data.hash && data.content_id && data.key && data.iv.length) {
        if (data.hash.length && data.content_id.length && typeof data.key === 'object' && data.key.hasOwnProperty('kty') && data.key.hasOwnProperty('alg')) {
            if (data.hash === await generateSHA256Hash(`${data.content_id}${JSON.stringify(data.key)}${data.iv}`)) {
                const irys = new NodeIrys({ url: "node2", token: "arweave", key: JSON.parse(wallet) })
                await irys.ready()
                const _return = await upload(data.key, data.content_id, data.iv)
                if (_return) {
                    res.status(200).send("Done")
                } else {
                    res.status(200).send("Something went wrong")
                }
            } else {
                res.status(400).send("Hash didn't matched")
            }
        } else {
            res.status(400).send("Not in right type")
        }
    } else {
        res.status(400).send("Fields are missing")
    }
})
app.get("/get/:content_id/:request_sender", async (req, res) => {
    const content_id = req.params.content_id
    const request_sender = req.params.request_sender
    if (content_id && request_sender) {
        const irys = new NodeIrys({ url: "node2", token: "arweave", key: JSON.parse(wallet) })
        await irys.ready()
        const data = await get(content_id, irys, request_sender)
        if (data === false) {
            res.status(404).send("Cannot Find the Data")
        } else {
            res.status(200).send({ key: JSON.stringify(data), iv: data.iv })
        }
    } else {
        res.status(400).send("Fields are missing")
    }
})
app.listen(8080, () => {
    console.log("running on port 8080")
})
// app.get("/get/p/:content_id/:playlist_id/:request_sender", async (req, res) => {
//     const content_id = req.params.content_id
//     const request_sender = req.params.request_sender
//     const playlist_id = req.params.playlist_id
//     if (content_id && request_sender) {
//         const irys = new NodeIrys({ url: "node2", token: "arweave", key: JSON.parse(wallet) })
//         await irys.ready()
//     }
// })
// type _p = { success: false, data: string } | { success: true, data: Playlist }
// async function get_p(c_id: string, p_id: string, sender: string, irys: NodeIrys) {
//     const contract = warp.contract<State>('ho2SbiQPHVB8enCQBU3Nh_qJtsK2iJ5Pi9G7nXoO5j0').connect(JSON.parse(wallet));
//     const bought = (await contract.readState()).cachedValue.state.bought.filter((e) => e.type === "playlist" && e.user === sender && e.id === p_id)
//     if (bought.length) {
//         const playlist = await contract.viewState<{ function: string, id: string }, _p>({ function: "get_playlist", id: p_id })
//         if (playlist.result.success) {
//             const _r = playlist.result.data.video_list.find((e) => e === c_id)
//             if (_r?.length) {
//                 const result = await contract.viewState<{ function: string, content_id: string }, _input>({ function: "get_encryption_key", content_id: c_id })

//             }
//         }
//     }
// }
async function generateSHA256Hash(data: string) {
    const encoder = new TextEncoder();
    const buffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(byte => byte.toString(16).padStart(2, '0')).join('');
    return hashHex;
}
async function upload(key: JsonWebKey, content_id: string, iv: string) {
    const irys = new NodeIrys({ url: "node2", token: "arweave", key: JSON.parse(wallet) })
    await irys.ready()
    const encrypted = encrypt(JSON.stringify(key))
    if (encrypted.encrypted.length && encrypted.iv.length) {
        const _upload = await irys.upload(encrypted.encrypted, { tags: [{ name: "Content-Id", value: content_id }] })
        if (_upload.id) {
            const contract = warp.contract('ho2SbiQPHVB8enCQBU3Nh_qJtsK2iJ5Pi9G7nXoO5j0').connect(JSON.parse(wallet))
            const result = await contract.writeInteraction({ function: "write_encryption_key", id: _upload.id, content_id: content_id, iv1: encrypted.iv, iv2: iv })
            if (result?.bundlrResponse?.id) {
                return true
            } else {
                return false
            }
        } else {
            return false
        }
    } else {
        return false
    }
}
type _input = { success: false; data: string } | { success: true, data: { id: string, content_id: string, writer: string, iv1: string, iv2: string } }
type _state = {

    bought: Array<{ type: "video" | "playlist", id: string, user: string }>
}

async function get(content_id: string, irys: NodeIrys, request_sender: string): Promise<false | { key: JsonWebKey, iv: string }> {
    const contract = warp.contract<State>('ho2SbiQPHVB8enCQBU3Nh_qJtsK2iJ5Pi9G7nXoO5j0').connect(JSON.parse(wallet));
    const result = await contract.viewState<{ function: string, content_id: string }, _input>({ function: "get_encryption_key", content_id: content_id })
    const state = (await contract.readState()).cachedValue.state.bought.filter((e) => e.user === request_sender)
    if (result.result.success) {
        if (result.result.data.content_id === content_id && state?.length) {
            const myQuery = new Query({ url: "https://node2.irys.xyz/graphql" });
            const _query = await myQuery.search('irys:transactions').ids([result.result.data.id])
            if (_query[0].id) {
                const _data = await axios.get(`https://gateway.irys.xyz/${_query[0].id}`, { maxRedirects: 4 })
                if (_data.data.length) {
                    const uncrypted_data: JsonWebKey = JSON.parse(decrypt(_data.data, result.result.data.iv1))
                    if (uncrypted_data.alg?.length) {
                        return { key: uncrypted_data, iv: result.result.data.iv2 }
                    } else {
                        return false
                    }
                } else {
                    return false
                }

            } else {
                return false
            }
        } else {
            return false
        }
    } else {
        return false
    }
}

function getKey(): Buffer {
    return crypto.createHash('sha256').update(wallet).digest();
}

function encrypt(text: string): { encrypted: string, iv: string } {
    const iv = crypto.randomBytes(16)
    const key = getKey();
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return { encrypted: encrypted, iv: iv.toString('hex') };
}

function decrypt(encrypted: string, iv: string): string {
    const key = getKey();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}