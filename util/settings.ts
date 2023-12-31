import {
	DeleteParameterCommand,
	GetParametersByPathCommand,
	PutParameterCommand,
	SSMClient,
	type Parameter,
} from '@aws-sdk/client-ssm'
import { paginate } from './paginate.js'

export enum Scope {
	PROVISION = 'provision',
	LAMBDA_CLAIM_CERTIFICATE = 'lambdaClaim',
}

const validScope = (scope: string): boolean => {
	return Object.values(Scope).map(String).includes(scope)
}

export const settingsPath = ({
	stackName,
	scope,
	property,
}: {
	stackName: string
	scope: string
	property?: string
}): string => {
	if (!validScope(scope)) throw new Error(`Invalid scope name`)

	const base = `/${stackName}/${scope}`
	return property === undefined ? base : `${base}/${property}`
}

const settingsName = ({
	stackName,
	scope,
	property,
}: {
	stackName: string
	scope: string
	property: string
}): string => settingsPath({ stackName, scope, property })
export const getSettings =
	<Settings extends Record<string, string>>({
		ssm,
		stackName,
		scope,
	}: {
		ssm: SSMClient
		stackName: string
		scope: string
	}) =>
	async (): Promise<Settings> => {
		const Path = settingsPath({ stackName, scope })
		const Parameters: Parameter[] = []
		await paginate({
			paginator: async (NextToken?: string) =>
				ssm
					.send(
						new GetParametersByPathCommand({
							Path,
							Recursive: true,
							NextToken,
						}),
					)

					.then(async ({ Parameters: p, NextToken }) => {
						if (p !== undefined) Parameters.push(...p)
						return NextToken
					}),
		})

		if (Parameters.length === 0)
			throw new Error(`System not configured: ${Path}!`)

		return Parameters.map(({ Name, ...rest }) => ({
			...rest,
			Name: Name?.replace(`${Path}/`, ''),
		})).reduce(
			(settings, { Name, Value }) => ({
				...settings,
				[Name ?? '']: Value ?? '',
			}),
			{} as Settings,
		)
	}

export const putSettings =
	({
		ssm,
		stackName,
		scope,
	}: {
		ssm: SSMClient
		stackName: string
		scope: string
	}) =>
	async ({
		property,
		value,
		deleteBeforeUpdate,
	}: {
		property: string
		value: string
		/**
		 * Useful when depending on the parameter having version 1, e.g. for use in CloudFormation
		 */
		deleteBeforeUpdate?: boolean
	}): Promise<{ name: string }> => {
		const Name = settingsName({ stackName, scope, property })
		if (deleteBeforeUpdate ?? false) {
			try {
				await ssm.send(
					new DeleteParameterCommand({
						Name,
					}),
				)
			} catch {
				// pass
			}
		}
		await ssm.send(
			new PutParameterCommand({
				Name,
				Value: value,
				Type: 'String',
				Overwrite: !(deleteBeforeUpdate ?? false),
			}),
		)
		return { name: Name }
	}

export const deleteSettings =
	({
		ssm,
		stackName,
		scope,
	}: {
		ssm: SSMClient
		stackName: string
		scope: string
	}) =>
	async ({ property }: { property: string }): Promise<{ name: string }> => {
		const Name = settingsName({ stackName, scope, property })
		try {
			await ssm.send(
				new DeleteParameterCommand({
					Name,
				}),
			)
		} catch (error) {
			if ((error as Error).name === 'ParameterNotFound') {
				// pass
			} else {
				throw error
			}
		}
		return { name: Name }
	}
