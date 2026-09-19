import { buildSeed } from "./seed-data";
import { detectIncidents } from "./incidents";
import { tokenEmbedding } from "./duplicates";
import type { AppSnapshot, Category, Issue } from "./types";

export function buildDemo(): AppSnapshot {
  const seed = buildSeed();
  const now = Date.now();
  const time = (minutes: number) => new Date(now - minutes * 60000).toISOString();
  const places = [
    {id:"demo-library", name:"Library, Second floor reading room", department:"Library" as const, lat:28.6108,lng:77.0385},
    {id:"demo-lab", name:"Lab Block, First floor computer lab", department:"IT" as const,lat:28.6102,lng:77.0365},
    {id:"demo-hostel",name:"Hostel A, Ground floor washroom",department:"Hostel" as const,lat:28.6092,lng:77.0368},
  ].map(place => ({...place,created_at:time(120)}));
  const snap: AppSnapshot = {...seed, locations:places, incidents:[], verifications:[], campus_boundary:{
    type:"rectangle", vertices:[{lat:28.608,lng:77.035},{lat:28.612,lng:77.035},{lat:28.612,lng:77.040},{lat:28.608,lng:77.040}], updated_at:time(120),
  }};
  const samples: [number,string,Category][] = [
    [0,"Lights are not working in the reading room.","Electrical / lights"],
    [0,"Projector is not turning on in the reading room.","Electrical / lights"],
    [0,"पंखा बंद है in the reading room.","Electrical / lights"],
    [1,"Wi-Fi is down in the computer lab.","Wi-Fi / network"],
    [1,"Internet is not connecting on the lab computers.","Wi-Fi / network"],
    [2,"Water is leaking below the washroom sink.","Water / leakage"],
    [2,"Wet floor and dripping pipe in the washroom.","Water / leakage"],
    [0,"Chair arm is broken beside the reading table.","Furniture"],
  ];
  samples.forEach(([placeIndex,description,category],index) => {
    const place = places[placeIndex];
    const id = `demo-issue-${index+1}`;
    const issue: Issue = {...seed.issues[0], id, cluster_id:`demo-cluster-${index+1}`,
      ticket_code:`CP-DEMO-${index+1}`, location_id:place.id, description,category,
      building:place.name,lat:place.lat,lng:place.lng,department:place.department,
      created_at:time(15-index), status:"open", assigned_at:null,resolved_at:null,
      worker_name:null,eta_at:null,escalated_at:null,photo_url:null,resolve_photo_url:null,
      verify_deadline_at:null,verified_count:0,disputed_count:0,verified_at:null,reopen_count:0,claim_round:0,
      embedding:tokenEmbedding(description),
    };
    snap.issues.push(issue);
    snap.clusters.push({id:issue.cluster_id,title:description,category,building:place.name,
      lat:place.lat,lng:place.lng,report_count:1,me_too_count:0,priority:issue.priority,
      is_recurring:false,status:"open",severity:issue.severity,created_at:issue.created_at});
  });
  // A confirmed example appears publicly; power and water remain for the admin to investigate.
  const network = detectIncidents(snap).find(candidate => candidate.kind === "network");
  if (network) snap.incidents!.push({id:network.id,kind:network.kind,issue_ids:network.issue_ids,
    title:network.title,place:network.place,decision:"confirmed",created_at:time(1),decided_by:"admin@campus.local"});
  for (const issue of snap.issues) {
    if (issue.status === "on_it") issue.worker_name = "Demo maintenance team";
    for (let index=0;index<issue.verified_count;index++) snap.verifications.push({
      id:`demo-verification-${issue.id}-${index}`,issue_id:issue.id,cluster_id:issue.cluster_id,
      client_hash:`demo-student-${index}`,verdict:"fixed",round:issue.claim_round,photo_url:null,created_at:issue.verified_at || time(30),
    });
  }
  return snap;
}
