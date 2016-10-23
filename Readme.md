
# weplay-compressor

Small script that compress incoming png Buffers with pngquant, and broadcasts it.

## How to install

```bash
$ npm install -g node-pngquant-native
$ npm install
```

And run it with the following ENV vars:

- `WEPLAY_REDIS` - redis uri (`localhost:6379`)
- `WEPLAY_IO_URL` - io server url (`http://localhost:3001`)


```bash
$ node index
```

## License

MIT
