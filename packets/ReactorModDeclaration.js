const { BaseReactorMessage } = require("./BaseReactorMessage");

class ReactorModDeclarationMessage extends BaseReactorMessage {
    static tag = 1;
    tag = 1;
    
    netid;
    modid;
    version;
    side;

    constructor(
        netid,
        modid,
        version,
        side
    ) {
        super();

        this.netid = netid;
        this.modid = modid;
        this.version = version;
        this.side = side;
    }

    static Deserialize(reader) {
        const netid = reader.packed();
        const modid = reader.string();
        const version = reader.string();
        const side = reader.uint8();

        return new ReactorModDeclarationMessage(netid, modid, version, side);
    }

    Serialize(writer) {
        writer.packed(this.netid);
        writer.string(this.modid);
        writer.string(this.version);
        writer.uint8(this.side);
    }
}

module.exports = { ReactorModDeclarationMessage };