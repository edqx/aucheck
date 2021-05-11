const { BaseMessage } = require("@skeldjs/protocol");

class BaseReactorMessage extends BaseMessage {
    static type = "reactor";
    type = "reactor";
}

module.exports = { BaseReactorMessage };