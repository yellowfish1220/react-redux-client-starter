import express from 'express';
import session from 'express-session';
import bodyParser from 'body-parser';
import config from '../src/config';
import * as actions from './actions/index';
import {mapUrl} from 'utils/url.js';
import PrettyError from 'pretty-error';
import http from 'http';
import SocketIo from 'socket.io';

const pretty = new PrettyError();
const app = express();
const server = new http.Server(app);

const io = new SocketIo(server);
io.path('/ws');


app.use(session({
  secret: 'react and redux rule!!!!',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 60000 }
}));

app.use(bodyParser.json());

app.use((req, res) => {

  const splittedUrlPath = req.url.split('?')[0].split('/').slice(1);
  const {action, params} = mapUrl(actions, splittedUrlPath);

  if (action) {
    action(req, params)
      .then((result) => {
        res.json(result);
      }, (reason) => {
        if (reason && reason.redirect) {
          res.redirect(reason.redirect);
        } else {
          console.error('API ERROR:', pretty.render(reason));
          res.status(reason.status || 500).json(reason);
        }
      });
  } else {
    res.status(404).end('NOT FOUND');
  }
});


const bufferSize = 100;
const messageBuffer = new Array(bufferSize);
let messageIndex = 0;


if (!config.mockApiPort) {
  console.error('==> ERROR: No PORT environment variable has been specified');
}

const runnable = app.listen(config.mockApiPort, (err) => {
  if (err) {
    console.error(err);
  }
  console.info('----\n==> 🌎 Mock API is running on port %s', config.mockApiPort);
  console.info('==> 💻 Send requests to http://%s:%s', 'localhost', config.mockApiPort);
});

io.on('connection', (socket) => {

  console.log('ws connection!');
  //socket.emit('news', {msg: `'Hello World!' from server`});

  setInterval(function() {
    //socket.emit('news', {msg: Math.floor(Math.random() * 1000) + 1  })
    socket.emit('msg', {
      'id': messageIndex++,
      'text': Math.floor(Math.random() * 1000) + 1
    });
  }, 2000);

  socket.on('history', () => {
    for (let index = 0; index < bufferSize; index++) {
      const msgNo = (messageIndex + index) % bufferSize;
      const msg = messageBuffer[msgNo];
      if (msg) {
        socket.emit('msg', msg);
      }
    }
  });

  socket.on('msg', (data) => {
    data.id = messageIndex;
    messageBuffer[messageIndex % bufferSize] = data;
    messageIndex++;
    io.emit('msg', data);
  });
});
io.listen(runnable);


