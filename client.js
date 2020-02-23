'use strict';

function BifrostSocket(options) {
    if (!new.target) return new BifrostSocket(options);
    if (!options.bridge) throw 'Must specify a bridge';
    this.options = options;
}

BifrostSocket.prototype.init = async function () {
    const options = this.options;
    if (options.bridge.startsWith('ws')) {
        // ws:// or wss://, using web socket routine
        const tun = new WebSocket(options.bridge + '/tunnels/' + options.protocol + '/' + options.host + '/' + options.port);

        this.buffer = [];
        tun.addEventListener('message', event => this.buffer.push(event.data));

        this.recv = () => {
            const r = this.buffer;
            this.buffer = [];
            return r;
        }
        this.send = data => tun.send(data);

        this.addEventListener = (event, listener) => {
            if (event === 'data') {
                tun.addEventListener('message', listener);
            } else if (event === 'close') {
                tun.addEventListener('close', listener);
            } else throw 'Unsupported event';
        };

        this.removeEventListener = (event, listener) => {
            if (event === 'data') {
                tun.removeEventListener('message', listener);
            } else if (event === 'close') {
                tun.removeEventListener('close', listener);
            } else throw 'Unsupported event';
        };

    } else if (options.bridge.startsWith('http')) {
        // http:// or https://, using HTTP routine

        let cb;
        let flag;

        const tunReq = new XMLHttpRequest();
        tunReq.open('POST', options.bridge + '/tunnels');
        tunReq.onreadystatechange = () => {
            if (tunReq.readyState !== 4) return;

            const tun = JSON.parse(tunReq.response);
            tun.bridge = options.bridge;
            const events = new EventSource(tun.bridge + tun.location + '/events?token=' + tun.token);

            // this.buffer = [];

            // events.addEventListener('message', () => {
            //     console.log('asdf');
            //     const recvReq = new XMLHttpRequest();
            //     recvReq.open('GET', tun.bridge + tun.location + '?token=' + tun.token);
            //     recvReq.onreadystatechange = () => {
            //         if (recvReq.readyState !== 4) return;
            //         this.buffer.push(recvReq.response);
            //     }
            //     recvReq.send();
            // });
            this.recv = async () => {
                let cb;
                let resp;
                const recvReq = new XMLHttpRequest();
                recvReq.open('GET', tun.bridge + tun.location + '?token=' + tun.token);
                recvReq.onreadystatechange = () => {
                    if (recvReq.readyState !== 4) return;
                    if (cb) cb([recvReq.response]);
                    else resp = recvReq.response;
                }
                recvReq.send();
                return new Promise(resolve => {
                    if (resp) resolve([resp]);
                    else cb = resolve;
                })
            };
            this.send = data => {
                const sendReq = new XMLHttpRequest();
                sendReq.open('POST', tun.bridge + tun.location + '?token=' + tun.token);
                sendReq.send(data);
            };
            this.addEventListener = (event, listener) => {
                if (event === 'data') {
                    events.addEventListener('message', listener);
                } else if (event === 'close') {
                    events.addEventListener('close', listener);
                } else throw 'Unsupported event';
            };
            this.removeEventListener = (event, listener) => {
                if (event === 'data') {
                    events.removeEventListener('message', listener);
                } else if (event === 'close') {
                    events.removeEventListener('close', listener);
                } else throw 'Unsupported event';
            };
            if (cb) return cb();
            else flag = true;
        };
        tunReq.send(JSON.stringify({ protocol: options.protocol, host: options.host, port: options.port }));

        return new Promise(resolve => {
            if (flag) return resolve();
            else cb = resolve;
        });
    }

}

BifrostSocket.prototype.on = function (event, listener) { return this.addEventListener(event, listener) }

BifrostSocket.prototype.removeListener = function (event, listener) { return this.removeEventListener(event, listener) }
BifrostSocket.prototype.off = function (event, listener) { return this.removeEventListener(event, listener) }