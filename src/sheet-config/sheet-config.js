
module.exports = function (RED) {
    function gauth(ctx) {
        RED.nodes.createNode(this, ctx);
        this.config = ctx.config;
    }

    RED.nodes.registerType("googleauth", gauth, {
        credentials: {
            config: {}
        }
    });
};
