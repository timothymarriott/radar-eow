// @ts-ignore
import cors from 'cors';
import express from 'express';
import path from 'path';
import responseTime from 'response-time';
import sqlite3 from 'better-sqlite3';
import * as util from './util';
import * as fs from 'fs';
import { Stream } from 'stream';


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

  result.translate = JSON.parse(result.translate)
  result.scale = JSON.parse(result.scale)
  result.params = JSON.parse(result.params)
  result.conditions = JSON.parse(result.conditions)
  result.data = JSON.parse(result.data)
  result.region12 = JSON.parse(result.region12)
  return result;
}

const FIELDS = 'objid, map_name, actor, name, translate, scale, params, conditions, hash_id, hash, data, group07_id, group10_id, region12';

// Returns object details for an object.
app.get('/obj/:objid', (req, res) => {
  const stmt = db.prepare(`SELECT ${FIELDS} FROM objs
    WHERE objid = @objid LIMIT 1`);
  const result = parseResult(stmt.get({
    objid: parseInt(req.params.objid, 0),
  }));
  if (!result.map_name)
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
    hash_id: parseInt(req.params.hash_id, 0),
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
      hash_id: parseInt(req.params.hash_id, 0),
    }).map(parseResult);
  if (!result.length)
    return res.status(404).json([]);
  res.json(result);
});

// Returns minimal object data for all matching objects.
function handleReqObjs(req: express.Request, res: express.Response) {
  const map: string | undefined = req.params.map;
  const q: string | null = getQueryParamStr(req, "q");
  const limitStr = getQueryParamStr(req, "limit");
  const limit: number = limitStr != null ? parseInt(limitStr, 10) : -1;
  if (!q) {
    res.json([]);
    return;
  }

  const getData = (x: any) => {
    return x;
  };

  const limitQuery = limit != -1 ? 'LIMIT @limit' : '';
  const query = `SELECT ${FIELDS} FROM objs
    WHERE map_name = @map_name
      AND objid in (SELECT rowid FROM objs_fts(@q))
    ${limitQuery}`;

  const stmt = db.prepare(query);

  res.json(stmt.all({
    map_name: map,
    q,
    limit,
  }).map(parseResult).map(getData));
}

app.get('/objs/:map', handleReqObjs);

const ALLOWED_REGION_TABLES = [7, 12, 16, 18].map(n => "region" + n.toString().padStart(2, "0"));
function handleReqRegions(req: express.Request, res: express.Response) {
  const region = req.params.region;
  const level = req.params.level;
  console.log(level)

  if (!ALLOWED_REGION_TABLES.includes(region)) {
    return res.status(400).json({ error: 'Invalid table name' });
  }

  const stmt = db.prepare(`
    SELECT * FROM ${region} WHERE map_name = @map_name
  `);

  const rows = stmt.all({ map_name: level }).map(row => {
    if (row.data) {
      try {
        row.data = JSON.parse(row.data);
      } catch (e) {
        row.data = {};
      }
    }
    return row;
  });

  res.json(rows);
}

app.get('/region/:level/:region', handleReqRegions)

app.get('/icon/:objid', (req, res) => {
  const stmt = db.prepare(`SELECT ${FIELDS} FROM objs
    WHERE objid = @objid LIMIT 1`);
  const result = parseResult(stmt.get({
    objid: parseInt(req.params.objid, 0),
  }));
  if (!result.map_name)
    return res.status(404).json({});


  let path = "content/images/" + result.actor + ".png";

  if (!fs.existsSync(path)) {
    return res.status(404).json({});
  }
  const r = fs.createReadStream(path) // or any other way to get a readable stream
  const ps = new Stream.PassThrough() // <---- this makes a trick with stream error handling
  Stream.pipeline(
   r,
   ps,
   (err) => {
    if (err) {
      return res.sendStatus(404);
    }
  })
  ps.pipe(res)
})


app.listen(3007);
