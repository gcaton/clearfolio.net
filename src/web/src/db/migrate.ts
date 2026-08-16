import { getDb, runMigrations } from './client'
import { seedReferenceData } from './seed'
import { resetPassphraseIfRequested } from './reset-passphrase'

const db = getDb()
runMigrations(db)
seedReferenceData(db)
resetPassphraseIfRequested(db)
console.log('Migrations applied and reference data seeded.')
