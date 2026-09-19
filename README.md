# SendCrate

> Temporary file sharing that stays out of your way.

SendCrate is a small, self-hosted file-sharing server for sending files through temporary links. It is designed around a simple idea: upload a file, get a link, and let the link disappear when you are done with it.

It supports passwords, expiration, download limits, QR codes, burn-after-download links, browser-side encryption, a command-line client, and local or S3-compatible storage through the storage adapter.

## Why SendCrate?

Most file-sharing tools make you create an account or keep files around longer than you need.

SendCrate focuses on short-lived transfers:

- no account required for recipients
- optional password protection
- automatic expiry
- download limits
- burn after the first successful download
- QR code sharing
- browser-side encryption for private links
- CLI uploads
- self-hosted
- SQLite metadata
- Docker-ready
- no analytics or tracking by default

## Privacy model

Normal shares are stored on the server as uploaded files.

Encrypted shares are different: the browser encrypts the file before upload using Web Crypto AES-256-GCM. The decryption key is kept in the URL fragment after `#`. URL fragments are handled by the browser and are not sent to the HTTP server.

Example:

`https://share.example.com/s/abc123#key=...`

This means the server can store the encrypted blob but does not receive the browser-side decryption key.

This is not a substitute for a security audit. Anyone who receives the complete link can decrypt the file.

## Features

### Sharing

- Drag and drop uploads
- Multiple files
- Password protection
- Expiry presets
- Maximum download count
- Burn after download
- QR code
- Copy link
- Download progress
- Automatic cleanup

### Developer features

- `sendcrate send file.zip`
- `--expires`
- `--downloads`
- `--password`
- `--burn`
- `--encrypt`
- JSON API
- Docker
- health endpoint

### Storage

The first release uses local disk storage through a storage adapter. The adapter is intentionally isolated so S3/MinIO/R2 can be added without changing the share API.

## Quick start

```bash
git clone https://github.com/YOUR_USERNAME/sendcrate.git
cd sendcrate
npm install
cp .env.example .env
npm start
```

Open:

`http://localhost:3000`

## Docker

```bash
docker compose up -d --build
```

The application listens on port 3000.

## CLI

After installing the project:

```bash
npm link
```

Then:

```bash
sendcrate send ./photo.png
```

With options:

```bash
sendcrate send ./build.zip --expires 2h --downloads 3
sendcrate send ./private.pdf --password "demo-password"
sendcrate send ./backup.zip --burn
sendcrate send ./secret.txt --encrypt
```

The CLI expects the server to expose the API at `SENDCRATE_URL`, or defaults to `http://localhost:3000`.

```bash
# PowerShell
$env:SENDCRATE_URL="https://share.example.com"
```

## API

### Create a share

`POST /api/shares`

Multipart form fields:

- `file`
- `expiresIn`
- `maxDownloads`
- `password`
- `burnAfterDownload`
- `encrypted`

Example:

```bash
curl -F "file=@photo.png" \
     -F "expiresIn=24h" \
     -F "maxDownloads=3" \
     http://localhost:3000/api/shares
```

Response:

```json
{
  "id": "7f3b...",
  "url": "http://localhost:3000/s/7f3b...",
  "expiresAt": "2026-09-20T10:00:00.000Z",
  "maxDownloads": 3
}
```

### Share metadata

`GET /api/shares/:id`

### Download

`GET /api/shares/:id/download`

For password-protected shares, send:

`X-SendCrate-Password: your-password`

## Security notes

Before exposing an instance to the public internet:

1. Put it behind HTTPS.
2. Change `ADMIN_TOKEN`.
3. Set an appropriate upload limit.
4. Add a reverse proxy rate limiter.
5. Consider object storage for large files.
6. Do not treat IP addresses as identity.
7. Keep the storage directory outside any public web root.
8. Consider malware scanning for untrusted public uploads.

SendCrate intentionally does not pretend that an upload server is a malware scanner.

## Project structure

```text
sendcrate/
├── cli/
│   └── sendcrate.js
├── public/
│   ├── app.js
│   ├── index.html
│   ├── share.js
│   ├── share.html
│   └── style.css
├── server/
│   ├── config.js
│   ├── db.js
│   ├── server.js
│   ├── storage.js
│   └── utils.js
├── test/
│   └── utils.test.js
├── data/
├── storage/
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── LICENSE
├── package.json
└── README.md
```

## Roadmap

- [x] Temporary links
- [x] Passwords
- [x] Download limits
- [x] Burn after download
- [x] QR codes
- [x] Browser-side encryption
- [x] CLI
- [x] Docker
- [x] Automatic cleanup
- [ ] S3 / MinIO / R2 adapter
- [ ] Resumable uploads
- [ ] Chunked encrypted uploads
- [ ] Share management dashboard
- [ ] Optional authentication for owners
- [ ] WebDAV import
- [ ] Desktop quick-share client
- [ ] i18n
- [ ] Automated security tests

## Contributing

Issues and pull requests are welcome.

Keep pull requests focused. Add tests for security-sensitive behavior and update the README when changing public APIs.

## License

MIT.
