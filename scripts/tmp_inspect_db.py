import sqlite3, json

db='prebuilt/parcelapp.db'
con=sqlite3.connect(db)
cur=con.cursor()
nums=['0522010201354']
print('Checking specific parcel(s):', nums)
for n in nums:
    cur.execute('SELECT id,num_parcel,village,geometry,properties FROM parcels WHERE num_parcel=?', (n,))
    r=cur.fetchone()
    if not r:
        print('Parcel',n,'not found')
    else:
        id,num_parcel,village,geometry,properties=r
        print('\nid',id,'num',num_parcel,'village:',village)
        print('geometry length:', len(geometry) if geometry else 0)
        geom_preview=(geometry[:200] + '...') if geometry and len(geometry)>200 else geometry
        print('geometry preview:', geom_preview)
        try:
            props=json.loads(properties) if properties else {}
            keys=sorted(list(props.keys()))
            print('properties keys count:', len(keys))
            print('properties keys sample:', keys[:40])
            print('Vocation/type_usag sample:', props.get('Vocation') or props.get('Vocation_1') or props.get('Vocation_01'), props.get('type_usag') or props.get('type_usa'))
        except Exception as e:
            print('props parse error', e)

# search for Lieu_nais occurrences
print('\nSearching for properties containing Netteboulou or Sinthiou (case-insensitive)')
for term in ['Netteboulou','Sinthiou']:
    print('\nTerm:',term)
    cur.execute("SELECT id,num_parcel,village,properties FROM parcels WHERE upper(properties) LIKE ? LIMIT 10", ('%'+term.upper()+'%',))
    rows=cur.fetchall()
    print('found',len(rows))
    for r in rows:
        id,num_parcel,village,properties=r
        print(' id',id,'num',num_parcel,'village',village)
        try:
            p=json.loads(properties)
            klist=list(p.keys())[:30]
            print('  sample keys:', klist)
            if 'Lieu_nais' in p: print('  Lieu_nais:', p['Lieu_nais'])
            for k in ['Village','village','VILLAGE','Lieu_nais','Locality','COMMUNE','Commune']:
                if k in p: print('   ',k,':',p[k])
        except Exception as e:
            print('  props parse error',e)

con.close()
