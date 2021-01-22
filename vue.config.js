const fs = require('fs');

module.exports = {
    devServer: {
        port: '8080',
        https: {
            key: fs.readFileSync('./certs/server.key'),
            cert: fs.readFileSync('./certs/server.cert'),
        },
    },
};
