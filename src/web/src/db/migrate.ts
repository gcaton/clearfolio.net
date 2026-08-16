import { getDb, runMigrations } from './client'
import { seedReferenceData } from './seed'

const db = getDb()
runMigrations(db)
seedReferenceData(db)
console.log('Migrations applied and reference data seeded.')
