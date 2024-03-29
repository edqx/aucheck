const express = require("express");
const path = require("path");
const fs = require("fs/promises");
const dns = require("dns");
const util = require("util");
const ratelimit = require("express-rate-limit");
const bodyParser = require("body-parser");
const zod = require("zod");
const checkIp = require("check-ip");

const skeldjs = require("@skeldjs/client");
const amongus = require("@skeldjs/constant");
const { ReactorClient, ReactorMod, ModPluginSide } = require("@skeldjs/reactor");
const { AcknowledgePacket, PingPacket, JoinGameMessage } = require("@skeldjs/protocol");
const { DisconnectReason } = require("@skeldjs/constant");

const port = process.env.PORT || 8080;
const public_dir = path.resolve(__dirname, "./public");

const server = express();

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const blocked_ips = new Set;
const resolveDns = util.promisify(dns.resolve);

server.use(bodyParser.json());

server.use((req, res, next) => {
    res.setHeader("X-ServerTime", Date.now());
    next();
});

server.get("/", (req, res) => {
    res.sendFile(path.resolve(public_dir, "./index.html"));
});

server.use("/static", express.static(path.resolve(public_dir, "./static")));

const invokeSchema = zod.object({
    ip: zod.string(),
    port: zod.number().int(),
    mode: zod.string().refine(str => str === "join" || str === "create" || str === "identify"),
    code: zod.string(),
    client_version: zod.string(),
    reactor_handshake: zod.boolean(),
    attempt_auth: zod.boolean(),
    mods: zod.array(
        zod.object({
            id: zod.string(),
            version: zod.string()
        })
    ),
    get_ping: zod.boolean()
});

const ip_regex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

server.post("/invoke", async (req, res, next) => {
    if (!invokeSchema.check(req.body)) {
        return res.status(400).json({ reason: "BAD_REQUEST" });
    }

    if (!req.body.ip)
        return res.status(400).json({ reason: "INVALID_IP" });

    if (process.env.NODE_ENV !== "development") {
        if (ip_regex.test(req.body.ip)) {
            const check = checkIp(req.body.ip);
            if (!check.isValid || !check.isPublicIp) {
                return res.status(400).json({ reason: "INVALID_IP" });
            }
        }
    }

    try {
        const addrs = await resolveDns(req.body.ip);

        if (blocked_ips.has(req.body.ip)) {
            return res.status(400).json({ reason: "BLOCKED" });
        }

        for (const addr of addrs) {
            if (blocked_ips.has(addr)) {
                return res.status(400).json({ reason: "BLOCKED" });
            }
        }
    } catch (e) {}

    next();
});

if (process.env.NODE_ENV !== "development") {
    server.use("/invoke", ratelimit({ windowMs: 15 * 1000, max: 1 }));
}

server.post("/invoke", async (req, res) => {
    const origResStatus = res.status.bind(res);
    res.status = code => res.headersSent ? { json() {} } : origResStatus(code);

    const port = req.body.port || 22023;

    try {
        const client = new skeldjs.SkeldjsClient(req.body.client_version, "aucheck", {
            useHttpMatchmaker: false,
            authMethod: skeldjs.AuthMethod.None,
            attemptAuth: req.body.attempt_auth
        });
        
        // impostor sucks
        client.decoder.on(JoinGameMessage, message => {
            if (message.error === DisconnectReason.IncorrectVersion) {
                client.destroy();
                return res.status(500).json({ reason: "BAD_VERSION" });
            } else {
                client.destroy();
                return res.status(500).json({ reason: "JOIN_FAIL" });
            }
        });

        if (req.body.reactor_handshake) {
            const reactor = new ReactorClient(client);

            for (const mod of req.body.mods) {
                reactor.registerMod(
                    new ReactorMod(
                        mod.id,
                        mod.version,
                        ModPluginSide.Both
                    )
                );
            }
        }

        const connect = await Promise.race([
            sleep(7000),
            client.connect(req.body.ip, port).then(() => true)
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
        } else if (req.body.mode === "create") {
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
        }

        if (req.body.get_ping) {
            const now = Date.now();
            const nonce = client.getNextNonce();
            client.send(new PingPacket(nonce));
            await client.decoder.waitf(AcknowledgePacket, ack => (console.log(ack), ack.nonce === nonce));
            const ms = Date.now() - now;
            
            client.disconnect();
            client.destroy();

            return res.status(200).json({ success: true, ping: ms });
        } else {
            client.disconnect();
            client.destroy();
            
            return res.status(200).json({ success: true });
        }
    } catch (e) {
        if (e.code === "ENOTFOUND") {
            return res.status(400).json({ reason: "INVALID_IP" });
        }
        console.log(e);
        return res.status(500).json({ reason: "UNKNOWN" });
    }
});

(async () => {
    try {
        const blocked_txt = await fs.readFile(path.resolve(process.cwd(), "./blocked.txt"), "utf8");

        const all_blocked = blocked_txt.split("\n");

        for (const blocked of all_blocked) {
            blocked_ips.add(blocked);
            try {
                const addrs = await resolveDns(blocked);
                
                for (const addr of addrs) {
                    blocked_ips.add(addr);
                }
            } catch (e) {}
        }
    } catch (e) {
        if (e.code === "ENOENT") {
            await fs.writeFile(path.resolve(process.cwd(), "./blocked.txt"), `eu.mm.among.us
na.mm.among.us
as.mm.among.us`, "utf8");
        } else {
            throw e;
        }
    }

    server.listen(port, () => {
        console.log("Listening on *:" + port);
    });
})();