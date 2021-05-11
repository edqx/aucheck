const { BaseReactorMessage } = require("./BaseReactorMessage");

class ReactorHandshakeMessage extends BaseReactorMessage {
    static tag = 0;
    tag = 0;

    constructor(
        servername,
        serverver,
        plugincount
    ) {
        super();

        this.servername = servername;
        this.serverver = serverver;
        this.plugincount = plugincount;
    }

    static Deserialize(reader) {
        const servername = reader.string();
        const serverver = reader.string();
        const plugincount = reader.packed();

        return new ReactorHandshakeMessage(servername, serverver, plugincount);
    }

    Serialize(writer) {
        writer.string(this.servername);
        writer.string(this.serverver);
        writer.packed(this.plugincount);
    }
}

module.exports = { ReactorHandshakeMessage };