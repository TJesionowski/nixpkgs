#!/usr/bin/env nix-shell
/*
#!nix-shell -i node -p nodejs-18_x
*/

import { promises as fs } from 'node:fs';

const constants = {
    githubUrl: "https://api.github.com/repos/pulsar-edit/pulsar/releases",
    sha256FileURL: (newVersion) => `https://github.com/pulsar-edit/pulsar/releases/download/v${newVersion}/SHA256SUMS.txt`,
    x86_64FileName: (newVersion) => `Linux.pulsar-${newVersion}.tar.gz`,
    aarch64FileName: (newVersion) => `ARM.Linux.pulsar-${newVersion}-arm64.tar.gz`,
    targetFile: new URL("default.nix", import.meta.url).pathname,
};

async function getLatestVersion() {
    const requestResult = await fetch(constants.githubUrl);
    if (!requestResult.ok) {
        console.error("Failed to fetch releases");
        console.error(requestResult);
        process.exit(1);
    };
    let jsonResult = await requestResult.json();

    jsonResult = jsonResult.filter((release) => !release.prerelease && !release.draft);
    if (jsonResult.length == 0) {
        console.error("No releases found");
        process.exit(1);
    }

    return jsonResult[0].tag_name.replace(/^v/, '');
}

async function getSha256Sum(hashFileContent, targetFile) {
    // The upstream file has a fomat like this:
    // 0000000000000000000000000000000000000000000000000000000000000000 targetFile

    let sha256 = hashFileContent.
        split('\n').
        filter((line) => line.endsWith(targetFile))[0].
        split(' ')[0];

    return "sha256-" + Buffer.from(sha256, 'hex').toString('base64');
}

async function getSha256Sums(newVersion) {
    // Upstream provides a file with the hashes of the files, but it's not in the SRI format, and it refers to the compressed tarball
    // So let's just use nix-prefetch-url to get the hashes of the decompressed tarball, and `nix hash to-sri` to convert them to SRI format
    const hashFileUrl = constants.sha256FileURL(newVersion);
    const hashFileContent = await fetch(hashFileUrl).then((response) => response.text());

    let x86_64;
    let aarch64;
    console.log("Getting new hashes");
    let promises = [
        getSha256Sum(hashFileContent, constants.x86_64FileName(newVersion)).then((hash) => { x86_64 = hash; }),
        getSha256Sum(hashFileContent, constants.aarch64FileName(newVersion)).then((hash) => { aarch64 = hash; }),
    ];
    await Promise.all(promises);
    return { x86_64, aarch64 };
}

async function updateFile(newVersion, sha256Sums, currentFile) {
    // There is some assumptions in how the file is formatted, but nothing egregious

    let newFile = currentFile.replace(/version = "(.*)";/, `version = "${newVersion}";`);
    newFile = newFile.replace(/x86_64-linux\.hash = "(.*)";/, `x86_64-linux.hash = "${sha256Sums.x86_64}";`);
    newFile = newFile.replace(/aarch64-linux\.hash = "(.*)";/, `aarch64-linux.hash = "${sha256Sums.aarch64}";`);

    await fs.writeFile(constants.targetFile, newFile);
};

let currentFile = await fs.readFile(constants.targetFile, 'utf8');
let currentVersion = currentFile.match(/version = "(.*)";/)[1];
const newVersion = await getLatestVersion();
if (currentVersion === newVersion) {
    console.error("Already up to date");
    process.exit(0);
}
console.log("New version: " + newVersion);
const sha256Sums = await getSha256Sums(newVersion);
console.log(sha256Sums)
if (!sha256Sums.x86_64 || !sha256Sums.aarch64) {
    console.error("Failed to find sha256 sums for the 2 files");
    process.exit(1);
}
updateFile(newVersion, sha256Sums, currentFile);
