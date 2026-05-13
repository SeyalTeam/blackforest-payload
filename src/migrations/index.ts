import * as migration_20260513_044621_init_migration from './20260513_044621_init_migration';

export const migrations = [
  {
    up: migration_20260513_044621_init_migration.up,
    down: migration_20260513_044621_init_migration.down,
    name: '20260513_044621_init_migration'
  },
];
