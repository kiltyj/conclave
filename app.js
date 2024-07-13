const express = require('express');
const path = require('path');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.static('public'));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.get('/', function (req, res) {
  res.render('index', {title: 'Conclave'});
});

var srv = app.listen(port, function() {
	console.log('Listening on '+port)
});

app.use('/peerjs', require('peer').ExpressPeerServer(srv));
