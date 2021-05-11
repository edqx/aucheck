const express = require("express");
const path = require("path");
const dns = require("dns");
const util = require("util");
const ratelimit = require("express-rate-limit");
const bodyParser = require("body-parser");
const zod = require("zod");
const skeldjs = require("@skeldjs/client");
const amongus = require("@skeldjs/constant");
const { AcknowledgePacket, ReliablePacket } = require("@skeldjs/protocol");

const { ModdedHelloPacket } = require("./packets/ModdedHello");
const { ReactorHandshakeMessage } = require("./packets/ReactorHandshake");
const { ReactorMessage } = require("./packets/ReactorMessage");
const { ReactorModDeclarationMessage } = require("./packets/ReactorModDeclaration");

const port = process.env.PORT || 8080;
const public_dir = path.resolve(__dirname, "./public");

const server = express();

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

server.use(bodyParser.json());

server.get("/", (req, res) => {
    res.sendFile(path.resolve(public_dir, "./index.html"));
});

server.use("/static", express.static(path.resolve(public_dir, "./static")));

const invokeSchema = zod.object({
    ip: zod.string(),
    port: zod.number().int(),
    mode: zod.string().refine(str => str === "join" || str === "create"),
    code: zod.string(),
    client_version: zod.string(),
    reactor_handshake: zod.boolean(),
    mods: zod.array(
        zod.object({
            id: zod.string(),
            version: zod.string()
        })
    )
});

const officials = [
    "eu.mm.among.us",
    "na.mm.among.us",
    "as.mm.among.us"
];

const blocked_ips = new Set;

(async () => {
    for (const official of officials) {
        dns.resolve(official, (err, addrs) => {
            if (err) {
                console.log("There was an error resolving DNS for", official);
                console.log(err);
                return;
            }

            for (const addr of addrs) {
                blocked_ips.add(addr);
            }
        });
    }
})();

server.post("/invoke", ratelimit({ windowMs: 30 * 1000, max: 1 }), async (req, res) => {
    if (!invokeSchema.check(req.body)) {
        return res.status(400).json({ reason: "BAD_REQUEST" });
    }

    if (!req.body.ip)
        return res.status(400).json({ reason: "INVALID_IP" });

    const port = req.body.port || 22023;

    try {
        const addrs = await util.promisify(dns.resolve)(req.body.ip);

        if (blocked_ips.has(req.body.ip)) {
            return res.status(400).json({ reason: "OFFICIALS" });
        }

        for (const addr of addrs) {
            if (blocked_ips.has(addr)) {
                return res.status(400).json({ reason: "OFFICIALS" });
            }
        }
    } catch (e) {

    }
    
    try {
        const client = new skeldjs.SkeldjsClient(req.body.client_version);

        if (req.body.reactor_handshake) {
            client.decoder.register(ModdedHelloPacket);
            client.decoder.register(ReactorHandshakeMessage);
            client.decoder.register(ReactorMessage);
            client.decoder.register(ReactorModDeclarationMessage);
    
            client.on("client.connect", async ev => {
                ev.cancel();
    
                const nonce = client.getNextNonce();
                await client.send(
                    new ModdedHelloPacket(
                        nonce,
                        client.version,
                        "aucheck",
                        0,
                        1,
                        0
                    )
                );
        
                await client.decoder.waitf(AcknowledgePacket, ack => ack.nonce ===  nonce);
        
                client.identified = true;
                client.username = "aucheck";
                client.token = 0;
    
                await client.send(
                    new ReliablePacket(
                        client.getNextNonce(),
                        req.body.mods.map((mod, i) => {
                            return new ReactorMessage(
                                new ReactorModDeclarationMessage(
                                    i,
                                    mod.id,
                                    mod.version,
                                    1
                                )
                            )
                        })
                    )
                );
            });
        }

        const connect = await Promise.race([
            sleep(3000),
            client.connect(req.body.ip, "aucheck", 0, port).then(() => true)
        ]);

        if (!connect) {
            client.destroy();
            return res.status(500).json({ reason: "TIMED_OUT_CONNECTING" });
        }

        if (req.body.mode === "join") {
            try {
                const code = await Promise.race([
                    sleep(3000),
                    client.joinGame(process.body.code, false)
                ]);

                if (!code) {
                    client.destroy();
                    return res.status(500).json({ reason: "TIMED_OUT_JOINING" });
                }
            } catch (e) {
                client.destroy();
                return res.status(500).json({ reason: "JOIN_FAIL" });
            }
        } else {
            try {
                const code = await Promise.race([
                    sleep(3000),
                    client.createGame({
                        map: amongus.GameMap.TheSkeld,
                        keywords: amongus.GameKeyword.English,
                        numImpostors: 2,
                        maxPlayers: 10
                    })
                ]);

                if (!code) {
                    client.destroy();
                    return res.status(500).json({ reason: "TIMED_OUT_CREATING" });
                }
            } catch (e) {
                client.destroy();
                console.log(e);
                return res.status(500).json({ reason: "CREATE_FAIL" });
            }

            await client.disconnect();
            client.destroy();

            return res.status(200).json({ success: true });
        }
        
        await client.disconnect();
        client.destroy();

        return res.status(200).json({ success: true });
    } catch (e) {
        console.log(e);
        return res.status(500).json({ reason: "UNKNOWN" });
    }
});

server.listen(port, () => {
    console.log("Listening on *:" + port);
});