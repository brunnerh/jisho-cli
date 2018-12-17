# jisho-cli

A small command line utility that converts results from [jisho.org](https://jisho.org) to plain terminalese.

Here some output for the search term `arashi`:

![screenshot](https://raw.githubusercontent.com/brunnerh/jisho-cli/master/readme-files/screenshot.png)

## Installation

The application can be installed from [npm](https://www.npmjs.com/):

```shell
npm install -g jisho-cli
```

`-g` installs it globally. If you have added your global Node `.bin` directory to the path you then can use the command `jisho-cli` anywhere.

## Usage

You can search for any term in English and Japanese (both Romaji and Kana/Kanji).

Examples:

```shell
% jisho-cli arashi
% jisho-cli 嵐
% jisho-cli storm
```

The flag `-i` can be used to start the application interactively. The user then is prompted for search terms repeatedly (the first search term can still be provided as argument). Pressing enter without entering any text exits the application.

Using interactive mode is recommended for multiple searches as it keeps the session/cache alive. Subsequent requests thus need to transmit less data.
