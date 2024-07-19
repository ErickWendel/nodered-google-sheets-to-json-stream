
module.exports = function (RED) {
    function gauth(n) {
        RED.nodes.createNode(this, n);
        this.creds = n.creds;
    }

    RED.nodes.registerType("gauth", gauth, {
        credentials: {
            creds: { type: "text" }
        }
    });
};
