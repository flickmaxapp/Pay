const AGENCY_ID = 'd7b06ca8-9c74-4f54-be70-f33a64141d81';
const crypto = require("crypto");
const fs = require("fs/promises");
const express = require("express");
const request = require("request");
const path = require("path");
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const cors = require('cors');
const nocache = require('nocache');
const app = express();
const port = process.env.PORT || "8000";
app.use(cors())
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(nocache());
/// router
app.post('/generate-payment-link', async (req, res) => {
    var id = req.body.id;
    var encryptDATA = encrypt(`${id}`);
    return res.json({ 'url': `${rootURL(req)}/payment/${encryptDATA.iv}/${encryptDATA.content}` })
});

app.get('/payment/:iv/:content', async (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/html'
    });
    const iv = req.params.iv;
    const content = req.params.content;
    const decryptData = decrypt({
        iv: iv,
        content: content
    });
    var htmlFile = path.join(process.cwd(), 'public/index.html');
    var innerHTML = await fs.readFile(htmlFile, { encoding: 'utf-8' });
    innerHTML = innerHTML.replace('{{payment_method}}', `${rootURL(req)}/payment-method/${decryptData}`);
    innerHTML = innerHTML.replace('{{payment_plan}}', decryptData);
    innerHTML = innerHTML.replace('{{request_payment}}', `${rootURL(req)}/request-payment`)
    return res.end(innerHTML);
});

app.get('/payment-method/:id', async (req, res) => {
    var id = req.params.id;
    var response = await promisifiedRequest({
        url: `https://payment.inspireui.com/membership/plan/${id}`,
        method: 'GET'
    });
    console.log(response.body);
    return res.json(JSON.parse(response.body));
});

app.post('/request-payment', async (req, res) => {
    var body = req.body;
    body['vendor'] = AGENCY_ID;
    var response = await promisifiedRequest({
        url: `https://payment.inspireui.com/membership/payment`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        form: body,
    });
    return res.json(JSON.parse(response.body));
});

app.listen(port, () => {
    console.log(`Listening to requests on http://localhost:${port}`);
});

async function promisifiedRequest(options) {
    return new Promise((resolve, reject) => {
        request(options, (error, response, body) => {
            if (response) {
                return resolve(response);
            }
            if (error) {
                return reject(error);
            }
        });
    });
};
const algorithm = 'aes-256-ctr';
const secretKey = '3s6z9x$B&E)H@McQfTjWnZb4t7w!z%C*';
const iv = crypto.randomBytes(16);

function decrypt(hash) {

    const decipher = crypto.createDecipheriv(algorithm, secretKey, Buffer.from(hash.iv, 'hex'));

    const decrpyted = Buffer.concat([decipher.update(Buffer.from(hash.content, 'hex')), decipher.final()]);

    return decrpyted.toString();
};

function encrypt(text) {

    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);

    const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);

    return {
        iv: iv.toString('hex'),
        content: encrypted.toString('hex')
    };
};

function rootURL(req) {
    return req.protocol + '://' + req.get('host');
}