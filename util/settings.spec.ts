import type { SSMClient } from '@aws-sdk/client-ssm'
import { Scope, settingsPath, getSettings } from './settings.js'
import assert from 'node:assert/strict'
import { describe, test as it } from 'node:test'

void describe('settingsPath()', () => {
	void it('should produce a fully qualified parameter name', () =>
		assert.equal(
			settingsPath({
				scope: Scope.LAMBDA_CLAIM_CERTIFICATE,
				stackName: 'fleet',
				property: 'someProperty',
			}),
			'/fleet/lambdaClaim/someProperty',
		))

	void it('should error for invalid string scope', () =>
		assert.throws(() =>
			settingsPath({
				scope: 'invalidScope',
				stackName: 'fleet',
				property: 'someProperty',
			}),
		))
})

void describe('getSettings()', () =>
	void it('should return the object with same scope', async () => {
		const returnedValues = [
			{
				Name: `/fleet/lambdaClaim/key1`,
				Value: 'value1',
			},
			{
				Name: `/fleet/lambdaClaim/key2`,
				Value: 'value2',
			},
			{
				Name: `/fleet/lambdaClaim/key3`,
				Value: 'value3',
			},
		]

		const stackConfig = getSettings({
			ssm: {
				send: async () => Promise.resolve({ Parameters: returnedValues }),
			} as unknown as SSMClient,
			stackName: 'fleet',
			scope: Scope.LAMBDA_CLAIM_CERTIFICATE,
		})

		const result = await stackConfig()
		assert.deepEqual(result, {
			key1: 'value1',
			key2: 'value2',
			key3: 'value3',
		})
	}))
