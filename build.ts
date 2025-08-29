import CRC32 from 'crc-32';
import fs from 'fs';
import path from 'path';
import sqlite3 from 'better-sqlite3';

const beco = require('./beco');

const yaml = require('js-yaml');

import { PlacementMap, PlacementObj, PlacementLink, ResPlacementObj } from './app/PlacementMap';
import * as util from './app/util';

const db = sqlite3('map.db.tmp');
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE objs (
  objid INTEGER PRIMARY KEY,
  map_name TEXT NOT NULL,
  hash INTEGER,

  actor TEXT NOT NULL,

  data JSON NOT NULL,
  params TEXT,
  conditions TEXT,
  scale TEXT,
  location TEXT
  );
`);



const insertObj = db.prepare(`INSERT INTO objs
  (objid, map_name, hash, actor, data, group07_id, group10_id, region12, params, conditions, scale, location)
  VALUES
  (@objid, @map_name, @hash, @actor, @data, @group07_id, @group10_id, @region12, @params, @conditions, @scale, @location)`);


function processMaps() {
  const MAP_PATH = 'content/map';
  let index = 0;
  for (const p of fs.readdirSync(MAP_PATH)) {


    let data: any = JSON.parse(fs.readFileSync(path.join('./content/map', p), 'utf8'));

    const map = p.split(".json")[0];
    console.log(map)




    for (const actor of data["actors"]) {
      console.log(actor[14])
      const result = insertObj.run({
        objid: index,
        map_name: map,
        hash: actor[14],
        conditions: JSON.stringify(actor[12]),
        ActorParams: actor[13],
        actor: actor[18],
        data: JSON.stringify(actor)
      });

      index++;
    }




  }
}
db.transaction(() => processMaps())();



db.close();
fs.renameSync('map.db.tmp', 'map.db');
