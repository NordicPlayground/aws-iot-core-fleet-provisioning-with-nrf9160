import chalk from 'chalk'
import { program } from 'commander'
import psjon from '../package.json'
import type { CommandDefinition } from './commands/CommandDefinition.js'
import { STSClient } from '@aws-sdk/client-sts'
import { generateClaimCertificate } from './commands/generate-claim-certificate.js'
import { IoTClient } from '@aws-sdk/client-iot'
import { SSMClient } from '@aws-sdk/client-ssm'
import { simulateDeviceCommand } from './commands/simulate-device.js'
import { generateLambdaProvisionCertificate } from './commands/generate-lambda-provision-certificate.js'
import { STACK_NAME } from '../cdk/stacks/stackConfig.js'
import { awsEnvironment } from '../cdk/helpers/awsEnvironment.js'

const iot = new IoTClient({})
const ssm = new SSMClient({})
const sts = new STSClient({})

const accountEnv = await awsEnvironment({ sts })

const die = (err: Error, origin: any) => {
	console.error(`An unhandled exception occurred!`)
	console.error(`Exception origin: ${JSON.stringify(origin)}`)
	console.error(err)
	process.exit(1)
}

process.on('uncaughtException', die)
process.on('unhandledRejection', die)

console.log('')

const CLI = async () => {
	program.name('./cli.sh')
	program.description(
		`Fleet provisioning ${psjon.version} Command Line Interface`,
	)
	program.version(psjon.version)

	const commands: CommandDefinition[] = [
		generateLambdaProvisionCertificate({
			iot,
			ssm,
			env: accountEnv,
		}),
		generateClaimCertificate({
			iot,
			ssm,
			env: accountEnv,
		}),
		simulateDeviceCommand({
			iot,
			ssm,
			stackName: STACK_NAME,
		}),
	]

	let ran = false
	commands.forEach(({ command, action, help, options }) => {
		const cmd = program.command(command)
		cmd
			.action(async (...args) => {
				try {
					ran = true
					await action(...args)
				} catch (error) {
					console.error(
						chalk.red.inverse(' ERROR '),
						chalk.red(`${command} failed!`),
					)
					console.error(chalk.red.inverse(' ERROR '), chalk.red(error))
					process.exit(1)
				}
			})
			.on('--help', () => {
				console.log('')
				console.log(chalk.yellow(help))
				console.log('')
			})
		if (options) {
			options.forEach(({ flags, description, defaultValue }) =>
				cmd.option(flags, description, defaultValue),
			)
		}
	})

	program.parse(process.argv)

	if (!ran) {
		program.outputHelp()
		throw new Error('No command selected!')
	}
}

CLI().catch((err) => {
	console.error(chalk.red(err))
	process.exit(1)
})
