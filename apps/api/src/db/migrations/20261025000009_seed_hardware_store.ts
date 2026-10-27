import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // 1. Categories
  const categories = [
    { code: 'tiles', name: 'Tiles & Ceramics', description: 'Porcelain, ceramic floor and glazed wall tiles' },
    { code: 'security_doors', name: 'Security & Armoured Doors', description: 'Armoured steel, Turkish and Italian security doors' },
    { code: 'sanitary_ware', name: 'Sanitary Ware & Bath Fittings', description: 'Water closets, vanity basins and chrome fixtures' },
    { code: 'paints', name: 'Paints & Wall Finishes', description: 'Interior silk emulsion, weather shield and gloss enamel' },
    { code: 'hardware', name: 'General Hardware & Fasteners', description: 'Locks, binding wire, screws and construction fasteners' },
  ];

  const catMap = new Map<string, number>();
  for (const cat of categories) {
    const existing = await knex('product_categories').where('code', cat.code).first();
    if (existing) {
      await knex('product_categories').where('id', existing.id).update(cat);
      catMap.set(cat.code, Number(existing.id));
    } else {
      const [row] = await knex('product_categories').insert(cat).returning('id');
      const id = typeof row === 'object' ? row.id : row;
      catMap.set(cat.code, Number(id));
    }
  }

  // 2. Subcategories
  const subcategories = [
    { category_id: catMap.get('tiles')!, code: 'porcelain_floor', name: 'Porcelain Floor Tiles' },
    { category_id: catMap.get('tiles')!, code: 'ceramic_wall', name: 'Ceramic Wall Tiles' },
    { category_id: catMap.get('security_doors')!, code: 'turkish_armoured', name: 'Turkish Armoured Doors' },
    { category_id: catMap.get('security_doors')!, code: 'steel_exterior', name: 'Steel Exterior Doors' },
    { category_id: catMap.get('sanitary_ware')!, code: 'water_closets', name: 'Close-Coupled Water Closets' },
    { category_id: catMap.get('sanitary_ware')!, code: 'wash_basins', name: 'Pedestal & Vanity Basins' },
    { category_id: catMap.get('paints')!, code: 'emulsion_silk', name: 'Premium Silk Emulsion' },
    { category_id: catMap.get('paints')!, code: 'weather_shield', name: 'Exterior Weather Shield' },
    { category_id: catMap.get('hardware')!, code: 'door_locks', name: 'Mortise & Cylinder Door Locks' },
    { category_id: catMap.get('hardware')!, code: 'site_hardware', name: 'Site Hardware & Binding Wire' },
  ];

  const subMap = new Map<string, number>();
  for (const sub of subcategories) {
    const existing = await knex('product_subcategories').where('code', sub.code).first();
    if (existing) {
      await knex('product_subcategories').where('id', existing.id).update(sub);
      subMap.set(sub.code, Number(existing.id));
    } else {
      const [row] = await knex('product_subcategories').insert(sub).returning('id');
      const id = typeof row === 'object' ? row.id : row;
      subMap.set(sub.code, Number(id));
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex('product_subcategories').del();
  await knex('product_categories').del();
}
