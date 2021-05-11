
const { BaseRootMessage } = require("@skeldjs/protocol");

class ReactorMessage extends BaseRootMessage {
    static tag = 0xff;
    tag = 0xff;

    constructor(
        message
    ) {
        super();

        this.children = message
            ? [message]
            : [];
    }

    static Deserialize(
        reader,
        direction,
        decoder
    ) {
        const reactorMessages = decoder.types.get("reactor");

        if (!reactorMessages) return new ReactorMessage();

        const tag = reader.uint8();
        const reactorMessageClass = reactorMessages.get(tag);

        if (!reactorMessageClass) return new ReactorMessage();

        const reactor = reactorMessageClass.Deserialize(
            reader,
            direction,
            decoder
        );

        return new ReactorMessage(reactor);
    }

    Serialize(
        writer,
        direction,
        decoder
    ) {
        const child = this.children[0];

        if (!child)
            return;

        const reactorMessages = decoder.types.get("reactor");

        if (!reactorMessages || !reactorMessages.has(child.tag)) return;

        writer.uint8(child.tag);
        writer.write(child, direction, decoder);
    }
}

module.exports = { ReactorMessage };