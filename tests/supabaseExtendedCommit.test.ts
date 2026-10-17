import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateDatabase } from '../src/lib/database-schema.mjs';
import { curveWriteEnabledFor, indexWriteEnabledFor, materialCrudEnabledFor } from '../src/lib/localEditing';
import {
  SupabaseSourceRenameRemoteCommittedError,
  commitSupabaseCategoryAdd,
  commitSupabaseCategoryRename,
  commitSupabaseCurve,
  commitSupabaseSourceAdd,
  commitSupabaseSourceRename,
} from '../src/lib/supabaseExtendedCommit';
import { SUPABASE_WRITE_IN_PROGRESS, createWriteLock, runSupabaseMaterialMutation } from '../src/lib/supabaseMaterialCommit';
import { SUPABASE_SOURCE_RENAME_REMOTE_COMMITTED } from '../src/lib/supabaseExtendedWrites';
import { isSupabaseAdminCapability } from '../src/lib/useMaterialAuth';
import type { MaterialAdminStatus } from '../src/lib/supabaseAuth';
import type { MasterDatabase } from '../src/lib/database-schema.mjs';
import type { Material, StressStrainData } from '../src/types';

const curve: StressStrainData = {
  points: [
    { strain: 0.02, stress: 100 },
    { strain: 0.001, stress: 10 },
  ],
  definition: 'engineering',
  strainKind: 'total',
  source: 'Web',
  notes: '順序',
};

function material(id: string, source = 'Web'): Material {
  return {
    id,
    name: id,
    category: 'Metal',
    source,
    notes: '',
    density: null,
    youngsModulus: null,
    poissonRatio: null,
    yieldStress: null,
    etan: null,
    ultimateStress: null,
    elongation: null,
    updatedAt: '2026-01-01T00:00:00.000Z',
    history: [{ at: '2026-01-01T00:00:00.000Z', action: 'created', summary: '建立記錄' }],
    stressStrainCurve: curve,
  };
}

function database(
  rows: Material[] = [material('kept'), material('other', 'Supplier')],
  sources: string[] = ['Supplier', 'Web'],
): MasterDatabase {
  return validateDatabase({
    schemaVersion: 1,
    materials: rows,
    indexes: {
      categories: [
        { id: 'Metal', label: '金屬', color: '#2563eb' },
        { id: 'Plastic', label: '塑膠', color: '#df8105' },
      ],
      sources,
    },
  });
}

test('curve commit replaces only the returned material and keeps point order', async () => {
  const original = database();
  const submitted: StressStrainData = {
    ...curve,
    points: [{ strain: 0.2, stress: 20 }, { strain: 0, stress: 0 }],
  };
  const returned: Material = {
    ...original.materials[0],
    notes: '來自伺服器',
    updatedAt: '2026-10-17T12:04:00.000Z',
    history: [{ at: '2026-10-17T12:04:00.000Z', action: 'edited', summary: '更新應力應變曲線' }, ...original.materials[0].history],
    stressStrainCurve: submitted,
  };
  const next = await commitSupabaseCurve(original, 'kept', submitted, async () => returned);
  assert.equal(next.materials[0], returned);
  assert.equal(next.materials[1], original.materials[1]);
  assert.deepEqual(next.materials[0].stressStrainCurve?.points, submitted.points);
  assert.equal(original.materials[0].notes, '');
  assert.equal(original.materials[0].stressStrainCurve, curve);
});

test('curve commit leaves the original database unchanged when the write fails', async () => {
  const original = database();
  await assert.rejects(commitSupabaseCurve(original, 'missing', curve, async () => {
    throw new Error('adapter should not run');
  }), /材料不存在/);
  await assert.rejects(commitSupabaseCurve(original, 'kept', curve, async () => ({
    ...original.materials[0],
    stressStrainCurve: { ...curve, points: [...curve.points].reverse() },
  })), /回傳的曲線與送出的曲線不一致/);
  assert.equal(original.materials[0].stressStrainCurve, curve);
  assert.deepEqual(original.indexes.categories.map(row => row.id), ['Metal', 'Plastic']);
});

test('category add keeps a zero-count category and does not change materials', async () => {
  const original = database();
  let calls = 0;
  const next = await commitSupabaseCategoryAdd(original, '泡棉', async () => {
    calls += 1;
    return { id: 'Foam', label: '泡棉', color: '#112233' };
  });
  assert.equal(calls, 1);
  assert.deepEqual(next.indexes.categories.at(-1), { id: 'Foam', label: '泡棉', color: '#112233' });
  assert.equal(next.materials, original.materials);
  assert.equal(next.materials.some(row => row.category === 'Foam'), false);
  await assert.rejects(commitSupabaseCategoryAdd(original, '金屬', async () => {
    throw new Error('adapter should not run');
  }), /已有相同名稱的分類/);
});

test('category rename changes only the label and uses the returned color', async () => {
  const original = database();
  const next = await commitSupabaseCategoryRename(original, 'Metal', '金屬材料', async () => ({
    id: 'Metal',
    label: '金屬材料',
    color: '#abcdef',
  }));
  assert.deepEqual(next.indexes.categories[0], { id: 'Metal', label: '金屬材料', color: '#abcdef' });
  assert.equal(next.indexes.categories[1], original.indexes.categories[1]);
  assert.equal(next.materials, original.materials);
  assert.equal(next.materials.every(row => row.category === 'Metal' || row.category === 'Plastic'), true);
  await assert.rejects(commitSupabaseCategoryRename(original, 'Metal', '金屬材料', async () => ({
    id: 'Other',
    label: '金屬材料',
    color: '#abcdef',
  })), /回傳的分類 id 與要求不一致/);
  assert.equal(original.indexes.categories[0].label, '金屬');
});

test('source add keeps a zero-count source in the existing sort', async () => {
  const original = database();
  const next = await commitSupabaseSourceAdd(original, 'Archive', async () => ({ name: 'Archive' }));
  assert.deepEqual(next.indexes.sources, ['Archive', 'Supplier', 'Web']);
  assert.equal(next.materials, original.materials);
  assert.equal(next.materials.some(row => row.source === 'Archive'), false);
  await assert.rejects(commitSupabaseSourceAdd(original, 'web', async () => {
    throw new Error('adapter should not run');
  }), /已有相同名稱的來源/);
});

test('source rename publishes the reread database and does not reread after an RPC failure', async () => {
  const original = database();
  let renames = 0;
  let reads = 0;
  const remote = database([
    { ...material('kept', 'Archive'), notes: '伺服器重新命名後' },
    material('other', 'Supplier'),
  ], ['Archive', 'Supplier']);
  const next = await commitSupabaseSourceRename(original, 'Web', ' Archive ', async (oldName, newName) => {
    renames += 1;
    assert.equal(oldName, 'Web');
    assert.equal(newName, ' Archive ');
    return { oldName: 'Web', newName: 'Archive', affectedCount: 1 };
  }, async () => {
    reads += 1;
    return remote;
  });
  assert.equal(renames, 1);
  assert.equal(reads, 1);
  assert.equal(next, remote);
  assert.equal(next.materials[0].notes, '伺服器重新命名後');
  assert.equal(original.materials[0].source, 'Web');

  reads = 0;
  renames = 0;
  await assert.rejects(commitSupabaseSourceRename(original, 'Web', 'Archive', async () => {
    renames += 1;
    const error = new Error('Supabase 重新命名來源失敗：42501');
    throw error;
  }, async () => {
    reads += 1;
    return remote;
  }), (error: unknown) => {
    assert.match(error instanceof Error ? error.message : '', /42501/);
    assert.notEqual((error as { remoteCommitted?: boolean }).remoteCommitted, true);
    return true;
  });
  assert.equal(renames, 1);
  assert.equal(reads, 0);
});

test('source rename name mismatches are remote commits and do not reread or retry', async () => {
  const original = database();
  for (const returned of [
    { oldName: 'Supplier', newName: 'Archive', affectedCount: 1 },
    { oldName: 'Web', newName: 'Other', affectedCount: 1 },
  ]) {
    let renames = 0;
    let reads = 0;
    await assert.rejects(commitSupabaseSourceRename(original, 'Web', 'Archive', async () => {
      renames += 1;
      return returned;
    }, async () => {
      reads += 1;
      throw new Error('reread should not run');
    }), (error: unknown) => {
      assert.equal(error instanceof SupabaseSourceRenameRemoteCommittedError, true);
      assert.equal(error instanceof Error ? error.message : '', SUPABASE_SOURCE_RENAME_REMOTE_COMMITTED);
      assert.equal((error as { remoteCommitted?: boolean }).remoteCommitted, true);
      return true;
    });
    assert.equal(renames, 1);
    assert.equal(reads, 0);
    assert.equal(original.materials[0].source, 'Web');
  }

  const lock = createWriteLock();
  const state = { current: original, writing: false };
  let renames = 0;
  await assert.rejects(lock.exclusive(async () => {
    state.writing = true;
    try {
      const committed = await runSupabaseMaterialMutation(state.current, database => commitSupabaseSourceRename(
        database,
        'Web',
        'Archive',
        async () => {
          renames += 1;
          return { oldName: 'Web', newName: 'Elsewhere', affectedCount: 1 };
        },
        async () => {
          throw new Error('reread should not run');
        },
      ));
      state.current = committed;
    } finally {
      state.writing = false;
    }
  }), (error: unknown) => error instanceof SupabaseSourceRenameRemoteCommittedError);
  assert.equal(renames, 1);
  assert.equal(state.current, original);
  assert.equal(state.writing, false);
  assert.equal(lock.pending, false);
});

test('source rename readback failure does not retry the RPC or change local state', async () => {
  const original = database();
  const lock = createWriteLock();
  const state = { current: original, writing: false };
  let renames = 0;
  let reads = 0;
  const run = () => lock.exclusive(async () => {
    state.writing = true;
    try {
      const committed = await runSupabaseMaterialMutation(state.current, database => commitSupabaseSourceRename(
        database,
        'Web',
        'Archive',
        async () => {
          renames += 1;
          return { oldName: 'Web', newName: 'Archive', affectedCount: 1 };
        },
        async () => {
          reads += 1;
          throw new Error('Supabase 讀取失敗：network');
        },
      ));
      state.current = committed;
      return committed;
    } finally {
      state.writing = false;
    }
  });
  await assert.rejects(run, (error: unknown) => {
    assert.equal(error instanceof SupabaseSourceRenameRemoteCommittedError, true);
    assert.equal(error instanceof Error ? error.message : '', SUPABASE_SOURCE_RENAME_REMOTE_COMMITTED);
    assert.equal((error as { remoteCommitted?: boolean }).remoteCommitted, true);
    return true;
  });
  assert.equal(renames, 1);
  assert.equal(reads, 1);
  assert.equal(state.current, original);
  assert.equal(state.writing, false);
  assert.equal(lock.pending, false);
});

test('the shared write lock stops a source add while a curve write is in flight', async () => {
  const original = database();
  const lock = createWriteLock();
  let release = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  let curveCalls = 0;
  let sourceCalls = 0;
  const first = lock.exclusive(() => runSupabaseMaterialMutation(original, database => commitSupabaseCurve(
    database,
    'kept',
    curve,
    async () => {
      curveCalls += 1;
      await gate;
      return original.materials[0];
    },
  )));
  await assert.rejects(lock.exclusive(() => runSupabaseMaterialMutation(original, database => commitSupabaseSourceAdd(
    database,
    'Archive',
    async () => {
      sourceCalls += 1;
      return { name: 'Archive' };
    },
  ))), new RegExp(SUPABASE_WRITE_IN_PROGRESS));
  release();
  await first;
  assert.equal(curveCalls, 1);
  assert.equal(sourceCalls, 0);
  assert.equal(lock.pending, false);
});

test('curve and index capabilities follow admin in Supabase and editable in legacy', () => {
  assert.equal(curveWriteEnabledFor('legacy', false, true), false);
  assert.equal(curveWriteEnabledFor('legacy', true, false), true);
  assert.equal(indexWriteEnabledFor('legacy', false, true), false);
  assert.equal(indexWriteEnabledFor('legacy', true, false), true);
  const blocked: MaterialAdminStatus[] = ['signed_out', 'checking', 'non_admin', 'error'];
  for (const status of blocked) {
    const admin = isSupabaseAdminCapability('supabase', status);
    assert.equal(curveWriteEnabledFor('supabase', true, admin), false, status);
    assert.equal(indexWriteEnabledFor('supabase', true, admin), false, status);
  }
  const admin = isSupabaseAdminCapability('supabase', 'admin');
  assert.equal(curveWriteEnabledFor('supabase', false, admin), true);
  assert.equal(indexWriteEnabledFor('supabase', false, admin), true);
  assert.equal(materialCrudEnabledFor('supabase', false, false), false);
  assert.equal(materialCrudEnabledFor('legacy', true, false), true);
});

test('storage keeps one write lock and does not let the UI reach extended mutations', async () => {
  const storage = await readFile(new URL('../src/lib/storage.ts', import.meta.url), 'utf8');
  const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8');
  assert.equal(storage.match(/createWriteLock\(/g)?.length, 1);
  assert.match(storage, /const editable = !supabaseActive && \(exampleMode \|\| fileStatus === 'linked'/);
  assert.match(storage, /extendedMutations = supabaseExtendedWriters \? \{/);
  assert.match(storage, /return supabaseReadOnly \? \{ \.\.\.state, materialMutations, extendedMutations \} : state/);
  assert.equal(storage.includes('saveCurve(id: string, curve: StressStrainData)'), true);
  assert.equal(storage.includes('renameSource(oldName: string, newName: string)'), true);
  assert.match(app, /extendedMutations\.saveCurve\(detail\.id, data\)/);
  assert.equal(app.includes('extendedMutations.addCategory'), false);
  assert.equal(app.includes('extendedMutations.renameSource'), false);
  assert.equal(app.includes('curveWriteEnabledFor'), true);
  assert.equal(app.includes('indexWriteEnabledFor'), false);
});
