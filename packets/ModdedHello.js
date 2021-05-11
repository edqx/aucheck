const { SendOption } = require("@skeldjs/constant");
const { BaseRootPacket } = require("@skeldjs/protocol");
const { VersionInfo } = require("@skeldjs/util");

class ModdedHelloPacket extends BaseRootPacket {
    static tag = SendOption.Hello;
    tag = SendOption.Hello;

    constructor(
        nonce,
        clientver,
        username,
        token,
        protocolver,
        modcount,
    ) {
        super();

        this.nonce = nonce;
        this.clientver = clientver;
        this.username = username;
        this.token = token;
        this.protocolver = protocolver;
        this.modcount = modcount;
    }

    static Deserialize(reader) {
        const nonce = reader.uint16(true);
        reader.jump(1); // Skip hazel version.
        const clientver = reader.read(VersionInfo);
        const username = reader.string();
        const token = reader.uint32();
        const protocolversion = reader.uint8();
        const modcount = reader.packed();

        return new ModdedHelloPacket(
            nonce,
            clientver,
            username,
            token,
            protocolversion,
            modcount
        );
    }

    Serialize(writer) {
        writer.uint16(this.nonce, true);
        writer.uint8(1);
        writer.write(this.clientver);
        writer.string(this.username);
        writer.uint32(this.token);
        writer.uint8(this.protocolver);
        writer.packed(this.modcount);
        writer.uint8(this.protocolver);
        writer.packed(this.modcount);
    }
}

module.exports = { ModdedHelloPacket };