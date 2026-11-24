// APOIS_MOTORISTA_VERIFIED_DB_TYPES_20261124
// Compile-time only. Public RPC declarations verified read-only against
// production Corridas: no runtime/database/payout changes and no source edits.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const workspace=resolve(process.env.APOIS_MOTORISTA_WORKSPACE||'.work/partner-motorista');
const path=resolve(workspace,'src/integrations/supabase/types.ts');
let src=readFileSync(path,'utf8');
const old=[
'      driver_set_presence: {',
'        Args: {',
'          _heading?: number',
'          _lat?: number',
'          _lng?: number',
'          _online: boolean',
'          _speed?: number',
'        }',
'        Returns: Json',
'      }'
].join('\n');
const replacement=[
'      // APOIS_MOTORISTA_VERIFIED_DB_TYPES_20261124: confirmed public RPC signatures.',
'      disconnect_my_mercadopago_driver: { Args: never; Returns: Json }',
'      driver_set_presence: {',
'        Args: {',
'          _heading?: number | null',
'          _lat?: number | null',
'          _lng?: number | null',
'          _online: boolean',
'          _speed?: number | null',
'        }',
'        Returns: Json',
'      }'
].join('\n');
if(src.split(old).length!==2||src.includes('disconnect_my_mercadopago_driver:'))
  throw Error('[FAIL] Corridas RPC definitions changed: review instead of force-editing');
src=src.replace(old,replacement);
if(src.split('APOIS_MOTORISTA_VERIFIED_DB_TYPES_20261124').length!==2)
  throw Error('[FAIL] Duplicate or absent verified RPC annotation');
writeFileSync(path,src,'utf8');
console.log('[OK] Workspace-only TypeScript RPC signatures align with verified Corridas database.');
