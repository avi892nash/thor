module.exports = {
  branches: ['main'],
  plugins: [
    '@semantic-release/commit-analyzer',
    '@semantic-release/release-notes-generator',
    ['@semantic-release/npm', { npmPublish: false, pkgRoot: 'server' }],
    ['@semantic-release/git', {
      assets: ['server/package.json', 'server/package-lock.json'],
      message: 'chore(release): ${nextRelease.version} [skip ci]',
    }],
    ['@semantic-release/github', {
      assets: [{ path: 'thor-api.deb', label: 'Thor Server (DEB)' }],
    }],
  ],
};
