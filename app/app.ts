import sqlite3 from 'better-sqlite3';
// @ts-ignore
import cors from 'cors';
import express from 'express';
import path from 'path';
import responseTime from 'response-time';

import * as util from './util';

const db = sqlite3(path.join(util.APP_ROOT, 'map.db'), {
  // @ts-ignore
  // verbose: console.log,
});
const app = express();

app.use(cors());
app.use(responseTime());

app.use(express.static(path.join(util.APP_ROOT, 'static')));

function getQueryParamStr(req: express.Request, name: string) {
  const param = req.query[name];
  if (param == null)
    return null;
  if (Array.isArray(param))
    return null;
  return param.toString();
}

function parseResult(result: any): { [key: string]: any } {
  if (!result)
    return {};

  result.data = JSON.parse(result.data);
  result.drop = JSON.parse(result.drops); // change from drops to drop
  result.drops = undefined;
  result.ui_drop = JSON.parse(result.ui_drops);

  result.equip = JSON.parse(result.equip);
  result.ui_equip = JSON.parse(result.ui_equip);
  result.Location = result.data?.Dynamic?.Location;
  result.ui_location = result.data?.Dynamic?.ui_location;
  if (result.data.Translate)
    result.pos = result.data.Translate.map((v: number) => Math.round(v * 100) / 100);
  else
    result.pos = [0, 0, 0];
  return result;
}

const FIELDS = 'objid, map_type, map_name, hash_id, unit_config_name as name, data, scale, drops, equip, map_static, ui_drops, ui_equip';

// Returns object details for an object.
app.get('/obj/:objid', (req, res) => {
  const stmt = db.prepare(`SELECT ${FIELDS} FROM objs
    WHERE objid = @objid LIMIT 1`);
  const result = parseResult(stmt.get({
    objid: parseInt(req.params.objid, 0),
  }));
  if (!result.map_type)
    return res.status(404).json({});
  res.json(result);
});

// Returns object details for an object.
app.get('/obj/:map_type/:map_name/:hash_id', (req, res) => {
  const stmt = db.prepare(`SELECT ${FIELDS} FROM objs
    WHERE map_type = @map_type
      AND map_name = @map_name
      AND hash_id = @hash_id LIMIT 1`);
  const result = parseResult(stmt.get({
    map_type: req.params.map_type,
    map_name: req.params.map_name,
    hash_id: req.params.hash_id,
  }));
  if (!result.map_type)
    return res.status(404).json({});
  res.json(result);
});

// Returns object details for an object.
app.get('/obj_by_hash/:hash_id', (req, res) => {
  const stmt = db.prepare(`SELECT ${FIELDS} FROM objs
    WHERE hash_id = @hash_id LIMIT 1`);
  const result = parseResult(stmt.get({
    hash_id: req.params.hash_id,
  }));
  if (!result.map_type)
    return res.status(404).json({});
  res.json(result);
});

// Returns the placement generation group for an object.
app.get('/obj/:map_type/:map_name/:hash_id/gen_group', (req, res) => {
  const result = db.prepare(`SELECT ${FIELDS} FROM objs
    WHERE gen_group =
       (SELECT gen_group FROM objs
          WHERE map_type = @map_type
            AND map_name = @map_name
            AND hash_id = @hash_id LIMIT 1)`)
    .all({
      map_type: req.params.map_type,
      map_name: req.params.map_name,
      hash_id: req.params.hash_id,
    }).map(parseResult);
  if (!result.length)
    return res.status(404).json([]);
  res.json(result);
});

// Returns the AI groups for an object.
app.get('/obj/:map_type/:map_name/:hash_id/ai_groups', (req, res) => {
  const result = db.prepare(`SELECT hash_id, data
    FROM ai_groups
    INNER JOIN ai_group_references
      ON ai_groups.id = ai_group_references.ai_group_id
    WHERE ai_group_references.object_id =
       (SELECT objid FROM objs
          WHERE map_type = @map_type
            AND map_name = @map_name
            AND hash_id = @hash_id LIMIT 1)`)
    .all({
      map_type: req.params.map_type,
      map_name: req.params.map_name,
      hash_id: req.params.hash_id,
    });
  if (!result.length)
    return res.status(404).json([]);
  res.json(result);
});

// Returns minimal object data for all matching objects.
function handleReqObjs(req: express.Request, res: express.Response) {
  const mapType: string | undefined = req.params.map_type;
  const mapName: string | undefined = req.params.map_name;
  const withMapNames: boolean = !!req.query.withMapNames;
  const q: string | null = getQueryParamStr(req, "q");
  const limitStr = getQueryParamStr(req, "limit");
  const limit: number = limitStr != null ? parseInt(limitStr, 10) : -1;
  if (!q) {
    res.json([]);
    return;
  }

  const selectAll = q === "*";

  const getData = (x: any) => {
    x.data = undefined;
    if (!withMapNames)
      x.map_name = undefined;
    return x;
  };

  const mapNameQuery = mapName ? `AND map_name = @map_name` : '';
  const limitQuery = limit != -1 ? 'LIMIT @limit' : '';
  const query = `SELECT ${FIELDS} FROM objs
    WHERE map_type = @map_type ${mapNameQuery}
    ${selectAll ? "" : "AND objid in (SELECT rowid FROM objs_fts(@q))"}
    ${limitQuery}`;

  const stmt = db.prepare(query);

  const rows = stmt.all({
    map_type: mapType,
    map_name: mapName ? mapName : undefined,
    q: selectAll ? undefined : q,
    limit,
  });
  res.json(rows.map(parseResult).map(getData))
}

app.get('/objs/:map_type', handleReqObjs);
app.get('/objs/:map_type/:map_name', handleReqObjs);

// Returns object IDs for all matching objects.
function handleReqObjids(req: express.Request, res: express.Response) {
  const mapType: string | undefined = req.params.map_type;
  const mapName: string | undefined = req.params.map_name;
  const q: string | null = getQueryParamStr(req, "q");
  if (!q) {
    res.json([]);
    return;
  }

  const mapNameQuery = mapName ? `AND map_name = @map_name` : '';
  const query = `SELECT objid FROM objs
    WHERE map_type = @map_type ${mapNameQuery}
      AND objid in (SELECT rowid FROM objs_fts(@q))`;

  const stmt = db.prepare(query);

  res.json(stmt.all({
    map_type: mapType,
    map_name: mapName ? mapName : undefined,
    q,
  }).map(x => x.objid));
}

app.get('/objids/:map_type', handleReqObjids);
app.get('/objids/:map_type/:map_name', handleReqObjids);



app.listen(3008);
