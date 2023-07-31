import { Bold, Faint, FgBrightGreen, FgBrightMagenta, FgBrightYellow, FgCyan, FgYellow, modify } from 'ansi-es6';
import commandLineArgs from 'command-line-args';
import commandLineUsage from 'command-line-usage';
import * as readline from 'readline';
import { fetch } from 'undici';
import { ColorOption, CommandLineArgs, isValidColorOption, OptionDefinition } from './command-line';
import { parse, Result, SupplementalInfo } from './parsing';
import pkg from '../package.json';

const base = 'https://jisho.org';

const main = async () =>
{
	const definitions: OptionDefinition[] = [
		{ name: 'help', alias: 'h', type: Boolean, defaultValue: false },
		{ name: 'interactive', alias: 'i', type: Boolean, defaultValue: false },
		{ name: 'reverse', alias: 'r', type: Boolean, defaultValue: false },
		{ name: 'color', alias: 'c', type: String, defaultValue: 'auto' },
		{ name: 'term', defaultOption: true, type: String },
	];
	const { help, interactive, term, reverse: topToBottom, color } = <CommandLineArgs>commandLineArgs(definitions);

	if (isValidColorOption(color) == false)
	{
		console.error(`Invalid value for 'color': ${color}`);
		process.exit(1);
	}

	if (help || interactive == false && term == null)
	{
		const usage = commandLineUsage([
			{
				header: 'jisho-cli',
				content: 'Look up a term, English or Japanese, on jisho.org.',
			},
			{
				header: 'Synopsis',
				content: [
					'jisho-cli [options] {underline term}',
					'jisho-cli [options] {bold -i} [{underline term}]',
				]
			},
			{
				header: 'Options',
				optionList: [
					{
						alias: 'i',
						name: 'interactive',
						description: 'If set, the application executes interactively. Faster when looking up multiple terms.',
					},
					{
						alias: 'c',
						name: 'color',
						description: 'Enables or disables color output.' +
							' Valid values are: {underline auto} (default), {underline always}, {underline never}.' +
							'\n{underline auto} enables coloring for TTYs.',
					},
					{
						alias: 'r',
						name: 'reverse',
						description: 'Show results top to bottom.',
					},
					{
						alias: 'h',
						name: 'help',
						description: 'Print this message.',
					}
				]
			}
		]);
		console.log(usage);
		process.exit(1);
	}

	// To catch Ctrl+D
	readline.emitKeypressEvents(process.stdin);
	if (process.stdin.isTTY)
		process.stdin.setRawMode!(true);

	const readInterface = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
		terminal: process.stdin.isTTY,
	});

	const colorize = conditionalModify(useColor(<ColorOption>color));

	const question = (q: string) => new Promise<string>(res =>
	{
		readInterface.question(q, answer =>
		{
			console.log();
			res(answer);
		});
	});

	let needInput = term == null;
	while (true)
	{
		const rawTerm = needInput ?
			await question(colorize("Search term: ", FgBrightYellow)) : term!;

		const currentTerm = rawTerm.trim();
		if (currentTerm == '')
			break;

		needInput = true;

		if (process.stdout.isTTY)
			process.stdout.write(colorize('Searching...', FgYellow));

		const clr = () =>
		{
			if (process.stdout.isTTY)
			{
				readline.clearLine(process.stdout, -1);
				readline.cursorTo(process.stdout, 0);
			}
		};

		try
		{
			const results = await lookUpTerm(currentTerm);
			clr();

			if (topToBottom == false)
				results.reverse();

			results.forEach(result =>
			{
				console.log(`${colorize(result.text, Bold, FgBrightGreen)} [${colorize(result.reading, FgBrightMagenta)}]:`);
				result.items.forEach(m =>
				{
					switch (m.type)
					{
						case 'meaning':
							const prefix = m.number === undefined
								? ''
								: (colorize(m.number, Faint) + ' ');
							
							const suffix = m.supplementalInfo.length == 0
								? ''
								: (colorize(' - ' + renderInfo(m.supplementalInfo), Faint));

							console.log(`\t${prefix}${m.text}${suffix}`);
							break;
						case 'tag':
							console.log(`\t${colorize(m.text, FgCyan)}`);
							break;
					}
				});
				console.log();
			});
		}
		catch (e)
		{
			clr();

			console.error("An error occurred fetching the results.");
			console.error(e);
		}

		if (interactive == false)
			break;
	}

	readInterface.close();
}

const useColor = (colorArgument: ColorOption) =>
{
	switch (colorArgument)
	{
		case 'auto':
			return 'NO_COLOR' in process.env == false && process.stdout.isTTY == true;
		case 'always':
			return true;
		case 'never':
			return false;
	}
}

const conditionalModify = (useColor: boolean) => (text: string, ...modifiers: string[]) =>
{
	return useColor ? modify(text, ...modifiers) : text;
}

async function lookUpTerm(term: string): Promise<Result[]>
{
	const response = await fetch(`${base}/search/${term}`, {
		headers: {
			'User-Agent': `jisho-cli v${pkg.version} (${pkg.repository.url})`,
		},
	});
	if (response.ok == false)
		throw new Error(`HTTP ${response.status}: ${response.statusText}`);

	const html = await response.text();
	return parse(html);
}

function renderInfo(supplementalInfo: SupplementalInfo[])
{
	return supplementalInfo
		.map(x =>
		{
			switch (x.type)
			{
				case 'tag':
					return x.text;
				case 'see-also':
					return `see also ${link(x.text, base + x.href)}`;
			}
		})
		.join(', ');
}

function link(text: string, href: string)
{
	return `\x1b]8;;${href}\x1b\\${text}\x1b]8;;\x1b\\`;
}

main();
