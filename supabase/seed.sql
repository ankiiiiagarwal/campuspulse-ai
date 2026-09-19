-- OPTIONAL demo data only. Do not run this for a live empty campus.
-- The running app does not auto-load these rows. Use LOAD_SEED=1 to show them locally.
-- 25 seeded issues. Health lands near 72:
-- 1 critical open, 3 high open, 4 medium open, 1 overdue, 1 recurring hotspot.
-- 100 - 6 - 9 - 4 - 4 - 5 = 72

truncate public.issue_confirmations, public.issues, public.issue_clusters restart identity cascade;

insert into public.issue_clusters
  (id, title, category, building, report_count, me_too_count, priority, is_recurring, lat, lng, status, severity, created_at)
values
  ('a1000000-0000-4000-8000-000000000001', 'Library Wi-Fi dead zone', 'Wi-Fi / network', 'Library', 3, 5, 72, true, 28.6108, 77.0385, 'open', 'high', now() - interval '10 days'),
  ('a1000000-0000-4000-8000-000000000002', 'Flickering tube lights in library', 'Electrical / lights', 'Library', 1, 0, 58, false, 28.61086, 77.03862, 'open', 'medium', now() - interval '20 hours'),
  ('a1000000-0000-4000-8000-000000000003', 'Broken chair near library stacks', 'Furniture', 'Library', 1, 0, 46, false, 28.6107, 77.0384, 'open', 'medium', now() - interval '30 hours'),
  ('a1000000-0000-4000-8000-000000000004', 'Leaking tap in Hostel B washroom', 'Water / leakage', 'Hostel B', 1, 1, 58, false, 28.60898, 77.03778, 'open', 'medium', now() - interval '12 hours'),
  ('a1000000-0000-4000-8000-000000000005', 'Hostel B Wi-Fi dead zone', 'Wi-Fi / network', 'Hostel B', 1, 2, 64, false, 28.609, 77.0378, 'open', 'high', now() - interval '5 hours'),
  ('a1000000-0000-4000-8000-000000000006', 'Hostel A washroom flush not working', 'Washroom', 'Hostel A', 1, 0, 48, false, 28.6092, 77.0368, 'open', 'low', now() - interval '18 hours'),
  ('a1000000-0000-4000-8000-000000000007', 'Dark pathway behind hostels', 'Road / path / safety', 'Main Road', 1, 3, 86, false, 28.6114, 77.03795, 'open', 'critical', now() - interval '6 hours'),
  ('a1000000-0000-4000-8000-000000000008', 'Flickering light in Lecture Hall 2', 'Electrical / lights', 'Lecture Hall Complex', 1, 0, 62, false, 28.6105, 77.0372, 'open', 'high', now() - interval '15 hours'),
  ('a1000000-0000-4000-8000-000000000009', 'Wobbly table in the mess', 'Furniture', 'Mess', 1, 0, 52, false, 28.6094, 77.0386, 'assigned', 'medium', now() - interval '108 hours'),
  ('a1000000-0000-4000-8000-000000000010', 'Academic block projector blank', 'Electrical / lights', 'Academic Block', 1, 0, 40, false, 28.611, 77.037, 'assigned', 'low', now() - interval '40 hours'),
  ('a1000000-0000-4000-8000-000000000011', 'Lab door lock jammed', 'Furniture', 'Lab Block', 1, 0, 38, false, 28.6102, 77.0365, 'on_it', 'low', now() - interval '20 hours'),
  ('a1000000-0000-4000-8000-000000000012', 'Garden sprinkler stuck on', 'Water / leakage', 'Garden', 1, 0, 34, false, 28.61, 77.0392, 'on_it', 'low', now() - interval '10 hours'),
  ('a1000000-0000-4000-8000-000000000013', 'Parking lot light out', 'Electrical / lights', 'Parking', 1, 0, 30, false, 28.6096, 77.036, 'resolved', 'low', now() - interval '8 days'),
  ('a1000000-0000-4000-8000-000000000014', 'Hostel A broken window latch', 'Hostel', 'Hostel A', 1, 0, 36, false, 28.60922, 77.03682, 'resolved', 'low', now() - interval '7 days'),
  ('a1000000-0000-4000-8000-000000000015', 'Mess serving counter messy', 'Mess', 'Mess', 1, 0, 36, false, 28.60942, 77.03862, 'resolved', 'low', now() - interval '5 days'),
  ('a1000000-0000-4000-8000-000000000016', 'Sports complex bench split', 'Furniture', 'Sports Complex', 1, 0, 32, false, 28.6086, 77.0382, 'resolved', 'low', now() - interval '9 days'),
  ('a1000000-0000-4000-8000-000000000017', 'Admin block AC drip', 'Water / leakage', 'Admin Block', 1, 0, 38, false, 28.6112, 77.0388, 'resolved', 'low', now() - interval '4 days'),
  ('a1000000-0000-4000-8000-000000000018', 'Pothole near main gate', 'Road / path / safety', 'Main Road', 1, 0, 54, false, 28.6115, 77.03805, 'resolved', 'medium', now() - interval '12 days'),
  ('a1000000-0000-4000-8000-000000000019', 'Broken chair in Lecture Hall 1', 'Furniture', 'Lecture Hall Complex', 1, 0, 36, false, 28.61048, 77.03718, 'assigned', 'low', now() - interval '25 hours'),
  ('a1000000-0000-4000-8000-000000000020', 'Hostel B washroom soap dispenser', 'Washroom', 'Hostel B', 1, 0, 40, false, 28.60902, 77.03776, 'on_it', 'low', now() - interval '14 hours'),
  ('a1000000-0000-4000-8000-000000000021', 'Library AC loud rattle', 'Other', 'Library', 1, 0, 32, false, 28.61076, 77.03844, 'resolved', 'low', now() - interval '3 days'),
  ('a1000000-0000-4000-8000-000000000022', 'Lab sink leak', 'Water / leakage', 'Lab Block', 1, 0, 44, false, 28.61022, 77.03652, 'resolved', 'medium', now() - interval '6 days'),
  ('a1000000-0000-4000-8000-000000000023', 'Academic stairs light replaced', 'Electrical / lights', 'Academic Block', 1, 0, 42, false, 28.61102, 77.03704, 'resolved', 'low', now() - interval '2 days');

insert into public.issues
  (id, ticket_code, description, category, severity, department, status, safety, location_weight, priority, lat, lng, building, cluster_id, created_at, assigned_at, resolved_at, eta_at)
values
  ('b1000000-0000-4000-8000-000000000001', 'CP-1001', 'Wi-Fi is completely dead in the library reading area. Cannot load even a single page.', 'Wi-Fi / network', 'high', 'IT', 'open', 3, 5, 72, 28.6108, 77.0385, 'Library', 'a1000000-0000-4000-8000-000000000001', now() - interval '8 hours', null, null, null),
  ('b1000000-0000-4000-8000-000000000002', 'CP-1002', 'Second floor library Wi-Fi still dropping every few minutes near the stacks.', 'Wi-Fi / network', 'high', 'IT', 'resolved', 3, 5, 70, 28.61082, 77.03848, 'Library', 'a1000000-0000-4000-8000-000000000001', now() - interval '6 days', now() - interval '5 days 22 hours', now() - interval '5 days 12 hours', null),
  ('b1000000-0000-4000-8000-000000000003', 'CP-1003', 'Reading room Wi-Fi was down again during evening study hours.', 'Wi-Fi / network', 'high', 'IT', 'resolved', 3, 5, 70, 28.61078, 77.03852, 'Library', 'a1000000-0000-4000-8000-000000000001', now() - interval '10 days', now() - interval '9 days 20 hours', now() - interval '9 days 4 hours', null),
  ('b1000000-0000-4000-8000-000000000004', 'CP-1004', 'Tube lights flickering in the library west wing. Hard to read for long.', 'Electrical / lights', 'medium', 'Library', 'open', 4, 5, 58, 28.61086, 77.03862, 'Library', 'a1000000-0000-4000-8000-000000000002', now() - interval '20 hours', null, null, null),
  ('b1000000-0000-4000-8000-000000000005', 'CP-1005', 'Broken chair near the library stacks. One leg is loose and it tips over.', 'Furniture', 'medium', 'Library', 'open', 2, 5, 46, 28.6107, 77.0384, 'Library', 'a1000000-0000-4000-8000-000000000003', now() - interval '30 hours', null, null, null),
  ('b1000000-0000-4000-8000-000000000006', 'CP-1006', 'Leaking tap in the Hostel B ground-floor washroom. The floor is wet and slippery.', 'Water / leakage', 'medium', 'Hostel', 'open', 3, 5, 58, 28.60898, 77.03778, 'Hostel B', 'a1000000-0000-4000-8000-000000000004', now() - interval '12 hours', null, null, null),
  ('b1000000-0000-4000-8000-000000000007', 'CP-1007', 'Hostel B Wi-Fi dead zone on the second floor. The router seems down and nobody can connect.', 'Wi-Fi / network', 'high', 'IT', 'open', 3, 5, 64, 28.609, 77.0378, 'Hostel B', 'a1000000-0000-4000-8000-000000000005', now() - interval '5 hours', null, null, null),
  ('b1000000-0000-4000-8000-000000000008', 'CP-1008', 'Flush in Hostel A washroom is not working. Queue forming in the morning.', 'Washroom', 'low', 'Hostel', 'open', 3, 5, 48, 28.6092, 77.0368, 'Hostel A', 'a1000000-0000-4000-8000-000000000006', now() - interval '18 hours', null, null, null),
  ('b1000000-0000-4000-8000-000000000009', 'CP-1009', 'Pathway behind the hostels is completely dark at night. No street light. Feels unsafe to walk.', 'Road / path / safety', 'critical', 'Campus', 'open', 5, 5, 86, 28.6114, 77.03795, 'Main Road', 'a1000000-0000-4000-8000-000000000007', now() - interval '6 hours', null, null, null),
  ('b1000000-0000-4000-8000-000000000010', 'CP-1010', 'Flickering tube light in Lecture Hall 2. Distracting during class and the fixture buzzes.', 'Electrical / lights', 'high', 'Campus', 'open', 4, 4, 62, 28.6105, 77.0372, 'Lecture Hall Complex', 'a1000000-0000-4000-8000-000000000008', now() - interval '15 hours', null, null, null),
  ('b1000000-0000-4000-8000-000000000011', 'CP-1011', 'Wobbly dining table in the mess near the window. Trays slide off.', 'Furniture', 'medium', 'Mess', 'assigned', 2, 5, 52, 28.6094, 77.0386, 'Mess', 'a1000000-0000-4000-8000-000000000009', now() - interval '108 hours', now() - interval '100 hours', null, null),
  ('b1000000-0000-4000-8000-000000000012', 'CP-1012', 'Projector in Academic Block room 204 stays blank after power on.', 'Electrical / lights', 'low', 'Campus', 'assigned', 2, 4, 40, 28.611, 77.037, 'Academic Block', 'a1000000-0000-4000-8000-000000000010', now() - interval '40 hours', now() - interval '36 hours', null, null),
  ('b1000000-0000-4000-8000-000000000013', 'CP-1013', 'Lab Block door lock is jammed. People are propping the door open.', 'Furniture', 'low', 'Campus', 'on_it', 2, 5, 38, 28.6102, 77.0365, 'Lab Block', 'a1000000-0000-4000-8000-000000000011', now() - interval '20 hours', now() - interval '16 hours', null, now() + interval '4 hours'),
  ('b1000000-0000-4000-8000-000000000014', 'CP-1014', 'Garden sprinkler is stuck on and flooding the lawn path.', 'Water / leakage', 'low', 'Campus', 'on_it', 2, 2, 34, 28.61, 77.0392, 'Garden', 'a1000000-0000-4000-8000-000000000012', now() - interval '10 hours', now() - interval '8 hours', null, now() + interval '2 hours'),
  ('b1000000-0000-4000-8000-000000000015', 'CP-1015', 'Parking lot light near the far row is out.', 'Electrical / lights', 'low', 'Campus', 'resolved', 2, 2, 30, 28.6096, 77.036, 'Parking', 'a1000000-0000-4000-8000-000000000013', now() - interval '8 days', now() - interval '7 days 20 hours', now() - interval '7 days 8 hours', null),
  ('b1000000-0000-4000-8000-000000000016', 'CP-1016', 'Broken window latch in Hostel A corridor. Window slams in the wind.', 'Hostel', 'low', 'Hostel', 'resolved', 3, 5, 36, 28.60922, 77.03682, 'Hostel A', 'a1000000-0000-4000-8000-000000000014', now() - interval '7 days', now() - interval '6 days 20 hours', now() - interval '6 days 6 hours', null),
  ('b1000000-0000-4000-8000-000000000017', 'CP-1017', 'Mess serving counter was left messy after dinner service.', 'Mess', 'low', 'Mess', 'resolved', 3, 5, 36, 28.60942, 77.03862, 'Mess', 'a1000000-0000-4000-8000-000000000015', now() - interval '5 days', now() - interval '4 days 22 hours', now() - interval '4 days 14 hours', null),
  ('b1000000-0000-4000-8000-000000000018', 'CP-1018', 'Wooden bench at the sports complex is split and has a sharp edge.', 'Furniture', 'low', 'Campus', 'resolved', 2, 3, 32, 28.6086, 77.0382, 'Sports Complex', 'a1000000-0000-4000-8000-000000000016', now() - interval '9 days', now() - interval '8 days 18 hours', now() - interval '8 days 6 hours', null),
  ('b1000000-0000-4000-8000-000000000019', 'CP-1019', 'AC in the admin lobby was dripping onto the floor.', 'Water / leakage', 'low', 'Campus', 'resolved', 3, 3, 38, 28.6112, 77.0388, 'Admin Block', 'a1000000-0000-4000-8000-000000000017', now() - interval '4 days', now() - interval '3 days 22 hours', now() - interval '3 days 10 hours', null),
  ('b1000000-0000-4000-8000-000000000020', 'CP-1020', 'Pothole near the main gate filled after last week''s repair.', 'Road / path / safety', 'medium', 'Campus', 'resolved', 4, 5, 54, 28.6115, 77.03805, 'Main Road', 'a1000000-0000-4000-8000-000000000018', now() - interval '12 days', now() - interval '11 days 16 hours', now() - interval '10 days 20 hours', null),
  ('b1000000-0000-4000-8000-000000000021', 'CP-1021', 'Broken chair in Lecture Hall 1 last row.', 'Furniture', 'low', 'Campus', 'assigned', 2, 4, 36, 28.61048, 77.03718, 'Lecture Hall Complex', 'a1000000-0000-4000-8000-000000000019', now() - interval '25 hours', now() - interval '20 hours', null, null),
  ('b1000000-0000-4000-8000-000000000022', 'CP-1022', 'Soap dispenser empty and loose in Hostel B washroom.', 'Washroom', 'low', 'Hostel', 'on_it', 3, 5, 40, 28.60902, 77.03776, 'Hostel B', 'a1000000-0000-4000-8000-000000000020', now() - interval '14 hours', now() - interval '10 hours', null, now() + interval '3 hours'),
  ('b1000000-0000-4000-8000-000000000023', 'CP-1023', 'Library AC had a loud rattle near the entrance.', 'Other', 'low', 'Library', 'resolved', 2, 5, 32, 28.61076, 77.03844, 'Library', 'a1000000-0000-4000-8000-000000000021', now() - interval '3 days', now() - interval '2 days 22 hours', now() - interval '2 days 10 hours', null),
  ('b1000000-0000-4000-8000-000000000024', 'CP-1024', 'Lab sink was leaking under the bench. Wiped and sealed.', 'Water / leakage', 'medium', 'Campus', 'resolved', 3, 5, 44, 28.61022, 77.03652, 'Lab Block', 'a1000000-0000-4000-8000-000000000022', now() - interval '6 days', now() - interval '5 days 20 hours', now() - interval '5 days 8 hours', null),
  ('b1000000-0000-4000-8000-000000000025', 'CP-1025', 'Stairwell light in the academic block was out and has been replaced.', 'Electrical / lights', 'low', 'Campus', 'resolved', 4, 4, 42, 28.61102, 77.03704, 'Academic Block', 'a1000000-0000-4000-8000-000000000023', now() - interval '2 days', now() - interval '1 day 22 hours', now() - interval '1 day 12 hours', null);

insert into public.issue_confirmations (id, cluster_id, client_hash, created_at) values
  ('c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'seed-device-1-0', now() - interval '4 hours'),
  ('c1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000001', 'seed-device-1-1', now() - interval '5 hours'),
  ('c1000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'seed-device-1-2', now() - interval '6 hours'),
  ('c1000000-0000-4000-8000-000000000004', 'a1000000-0000-4000-8000-000000000001', 'seed-device-1-3', now() - interval '7 hours'),
  ('c1000000-0000-4000-8000-000000000005', 'a1000000-0000-4000-8000-000000000001', 'seed-device-1-4', now() - interval '8 hours'),
  ('c1000000-0000-4000-8000-000000000006', 'a1000000-0000-4000-8000-000000000005', 'seed-device-5-0', now() - interval '3 hours'),
  ('c1000000-0000-4000-8000-000000000007', 'a1000000-0000-4000-8000-000000000005', 'seed-device-5-1', now() - interval '4 hours'),
  ('c1000000-0000-4000-8000-000000000008', 'a1000000-0000-4000-8000-000000000007', 'seed-device-7-0', now() - interval '2 hours'),
  ('c1000000-0000-4000-8000-000000000009', 'a1000000-0000-4000-8000-000000000007', 'seed-device-7-1', now() - interval '3 hours'),
  ('c1000000-0000-4000-8000-000000000010', 'a1000000-0000-4000-8000-000000000007', 'seed-device-7-2', now() - interval '4 hours'),
  ('c1000000-0000-4000-8000-000000000011', 'a1000000-0000-4000-8000-000000000004', 'seed-device-4-0', now() - interval '5 hours');
