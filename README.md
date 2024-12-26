# Dufi
CLI application that helps you find and manage duplicate files.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
  - [Requirements](#requirements)
  - [Supported Platforms](#supported-platforms)
  - [Install via npm (recommended)](#install-via-npm-recommended)
  - [Install from source (might require pnpm, haven't tested yet)](#install-from-source-might-require-pnpm-havent-tested-yet)
- [Usage](#usage)
- [Contributing](#contributing)
- [License](#license)

## Features

- [x] Scan duplicate files in multiple directories
- [x] Delete duplicate files
- [x] Keep one file and delete the others on each duplicate group
- [x] Web interface

## Installation

### Requirements
[Node.js](https://nodejs.org/) 18.x or higher

### Supported Platforms
Currently works best on Windows. Should work on Linux and MacOS with limitation, but not tested.

### Install via npm (recommended)

```bash
# npm
npm install -g dufi
```

### Install from source (might require [pnpm](https://pnpm.io/), haven't tested yet)

```bash
# Clone the repository
git clone https://github.com/gegehprast/dufi.git

# Change directory
cd dufi

# Install dependencies
npm install

# Link the package
npm link
```

## Usage

```bash
# Scan current directory
dufi scan .

# Scan multiple directories
dufi scan /path/to/directory1 /path/to/directory2/sub

# Purge cached hash
dufi purge
```


## Contributing

1. Fork the repository
2. Create a new branch (`git checkout -b feature-branch`)
3. Commit your changes (`git commit -am 'Add new feature'`)
4. Push to the branch (`git push origin feature-branch`)
5. Create a new Pull Request

## License

This project is licensed under the MIT License.
