# M30 · Transport

## 1 · Purpose

School buses and vans: vehicles, drivers, routes and stops, which child rides which route, the daily trips with boarding and drop-off recorded, and what the fleet costs. Its first duty is safety: the school always knows which children are on which vehicle, and that every one of them got off.

## 2 · Depends on

[M07](m07-students.md), [M26](m26-staff-recruitment.md) (`staff`), [M04](m04-school-setup.md) (shifts, holidays), [M21](m21-fees.md) (transport charge), [M24](m24-expenses-procurement.md) (vendors, expenses), [M05](m05-integrations-api.md) (vehicle trackers). Reads [M14](m14-student-attendance.md) and [M09](m09-front-office.md) for who is absent or left early.

## 3 · Tables

#### `vehicles` · branch

| Column | Type | Rules |
|---|---|---|
| registration_no | text | required; unique per organisation; "LEA-1234" |
| name | text | optional; "Bus 3" |
| kind | enum(bus, coaster, van, car, rickshaw) | required |
| make_model | text | optional |
| seats | int | required; > 0; student seats, not counting driver and attendant |
| ownership | enum(owned, contracted) | default owned |
| contractor_vendor_id | uuid → vendors | optional; required for `contracted` |
| fitness_expires_on | date | optional |
| insurance_expires_on | date | optional |
| route_permit_expires_on | date | optional |
| token_tax_paid_until | date | optional |
| tracker_id | text | optional; the tracker's device id |
| odometer_km | int | default 0 |
| last_latitude | numeric(9,6) | optional |
| last_longitude | numeric(9,6) | optional |
| last_seen_at | timestamptz | optional |
| status | enum(active, in_workshop, retired) | default active |

#### `drivers` · org
Driving details of a staff member who drives.

| Column | Type | Rules |
|---|---|---|
| staff_id | uuid → staff | required; unique |
| licence_no | text | required |
| licence_category | text | required; "LTV", "HTV", "PSV" |
| licence_expires_on | date | required |
| medical_valid_until | date | optional |
| police_verified_on | date | optional |
| is_active | bool | default true |

#### `transport_routes` · branch

| Column | Type | Rules |
|---|---|---|
| name | text | required; unique per branch; "Route 4 — Johar Town" |
| code | text | required; unique per branch |
| shift_id | uuid → shifts | optional |
| vehicle_id | uuid → vehicles | optional until assigned |
| driver_staff_id | uuid → staff | optional; must have a `drivers` row |
| attendant_staff_id | uuid → staff | optional |
| pickup_start_time | time | optional |
| drop_start_time | time | optional |
| distance_km | numeric(6,1) | optional |
| status | enum(active, inactive) | default active |

#### `route_stops` · branch

| Column | Type | Rules |
|---|---|---|
| route_id | uuid → transport_routes | required |
| name | text | required |
| name_ur | text | optional |
| sort_order | int | required; the order on the morning run |
| pickup_time | time | optional |
| drop_time | time | optional |
| latitude | numeric(9,6) | optional |
| longitude | numeric(9,6) | optional |
| landmark | text | optional |
| monthly_fee | paisa | required; ≥ 0; the fare from this stop, both ways |

Policy: staff of the branch; families may read stops of active routes.
Unique: (route_id, sort_order); (route_id, name) among live rows.

#### `transport_assignments` · branch +family

| Column | Type | Rules |
|---|---|---|
| student_id | uuid → students | required |
| route_id | uuid → transport_routes | required |
| stop_id | uuid → route_stops | required; a stop of that route |
| direction | enum(both, pickup_only, drop_only) | default both |
| from_date | date | required |
| to_date | date | optional |
| monthly_fee | paisa | required; copied from the stop, reduced for one way by the setting |
| fee_item_id | uuid → student_fee_items | optional; the charge it created |
| handover_note | text | optional; who receives the child at the stop |
| status | enum(active, ended) | default active |

Unique: one active assignment per student.
Index: (org_id, route_id, status).

#### `transport_requests` · branch +family

| Column | Type | Rules |
|---|---|---|
| student_id | uuid → students | required |
| kind | enum(start, change_stop, stop) | required |
| stop_id | uuid → route_stops | optional; required for `start` and `change_stop` |
| direction | enum(both, pickup_only, drop_only) | default both |
| from_date | date | required |
| note | text | optional |
| status | enum(pending, approved, rejected, cancelled) | default pending |
| decided_by | uuid → profiles | optional |
| decision_note | text | optional |

Policy: a guardian may insert for their own child, read their own and cancel a pending one.

#### `trips` · branch
One run of a route, morning or afternoon.

| Column | Type | Rules |
|---|---|---|
| route_id | uuid → transport_routes | required |
| trip_date | date | required |
| direction | enum(pickup, drop) | required |
| vehicle_id | uuid → vehicles | required; may differ from the route's when a replacement is used |
| driver_staff_id | uuid → staff | required |
| attendant_staff_id | uuid → staff | optional |
| status | enum(scheduled, running, completed, cancelled) | default scheduled |
| started_at | timestamptz | optional |
| ended_at | timestamptz | optional |
| start_odometer_km | int | optional |
| end_odometer_km | int | optional; ≥ start |
| expected_count | int | default 0; riders expected when it started |
| note | text | optional |

Policy: staff of the branch; families may read a trip of their child's route.
Unique: (route_id, trip_date, direction).

#### `trip_events` · branch +family

| Column | Type | Rules |
|---|---|---|
| trip_id | uuid → trips | required |
| student_id | uuid → students | required |
| stop_id | uuid → route_stops | optional |
| event | enum(boarded, dropped, no_show, not_riding) | required |
| happened_at | timestamptz | required |
| recorded_by | uuid → profiles | required |
| source | enum(app, card_scan, manual) | default app |
| handed_to | text | optional; on drop-off, when the school requires a named adult |

Unique: (trip_id, student_id, event).

#### `vehicle_locations` · branch append-only
High volume. Partitioned by month; kept 90 days.

| Column | Type | Rules |
|---|---|---|
| vehicle_id | uuid → vehicles | required |
| trip_id | uuid → trips | optional |
| recorded_at | timestamptz | required |
| latitude | numeric(9,6) | required |
| longitude | numeric(9,6) | required |
| speed_kmh | int | optional |
| source | enum(tracker, phone) | required |

Policy: staff of the branch with `transport:read`. Families never read this table; they get the vehicle's latest position through the route, only while their child's trip is running.
Index: (vehicle_id, recorded_at).

#### `vehicle_maintenance` · branch

| Column | Type | Rules |
|---|---|---|
| vehicle_id | uuid → vehicles | required |
| kind | enum(service, repair, tyres, battery, inspection, accident, other) | required |
| done_on | date | required |
| odometer_km | int | optional |
| description | text | required |
| cost | paisa | default 0 |
| vendor_id | uuid → vendors | optional |
| expense_id | uuid → expenses | optional |
| next_due_on | date | optional |
| next_due_km | int | optional |

#### `fuel_logs` · branch

| Column | Type | Rules |
|---|---|---|
| vehicle_id | uuid → vehicles | required |
| filled_on | date | required |
| litres | numeric(7,2) | required; > 0 |
| amount | paisa | required; > 0 |
| odometer_km | int | required; not less than the previous log's |
| station | text | optional |
| filled_by_staff_id | uuid → staff | optional |
| receipt_file_id | uuid → files | optional |
| expense_id | uuid → expenses | optional |
| km_per_litre | numeric(6,2) | optional; computed against the previous fill |

## 4 · Contracts

`packages/contracts/src/modules/transport/`: `vehicles`, `drivers`, `transport-routes`, `route-stops`, `transport-assignments`, `transport-requests`, `trips`, `vehicle-costs`.

- `RouteSheet`: a route with its stops in order and the riders at each stop.
- `TripManifest`: for a trip — riders in stop order, each with photo, class, guardian phone, and today's state: expected, absent from school, left early with a gate pass, boarded, dropped.
- `TripProgress`: counts expected, boarded, dropped; the stop reached; the vehicle's last position.
- `ChildTransport` (family): route, stop, timings, driver and attendant names with work phone, today's trip state, and the vehicle position while a trip runs.
- `FleetCost`: per vehicle per month — fuel, maintenance, km, cost per km, fare income from its route.

Settings: `transport.one_way_percent` (default 60), `transport.proration` (follows `fees.proration`), `transport.notify_boarding` (default true), `transport.notify_drop` (default true), `transport.share_location` (default true), `transport.speed_alert_kmh` (default 60), `transport.over_capacity` (`block` | `warn`, default block), `transport.named_handover` (default false; required for grades up to `transport.named_handover_max_grade`).

## 5 · Rules

- **R-transport-1** A route needs a vehicle and a driver before a trip can start. The driver must have a current licence; an expired licence blocks starting a trip.
- **R-transport-2** The active riders of a route cannot exceed its vehicle's seats, by `transport.over_capacity`.
- **R-transport-3** A student has one active assignment. Starting one creates a `student_fee_items` row (source `transport`) for the stop's fare from that month, reduced to `transport.one_way_percent` for one direction; ending it closes that fee item at the end of the month. Changing stop ends one and starts another on the same date.
- **R-transport-4** A guardian's transport request does nothing until the transport manager approves it. Approval makes the assignment.
- **R-transport-5** When a student leaves the school or transfers branch, their assignment ends on the same date.
- **R-transport-6** A job creates the day's two trips for each active route on every working day. A replacement vehicle or driver is set on the trip, not on the route.
- **R-transport-7** A trip's manifest marks a rider `not_riding` automatically when, for the drop trip, the school attendance says absent or a gate pass shows they left; for the pickup trip, when the guardian has reported leave for the day.
- **R-transport-8** Only the trip's driver or attendant, or a transport manager, records its events. `boarded` and `dropped` are each recorded once per rider.
- **R-transport-9** **A trip cannot be completed while any rider who boarded has no drop event.** The app lists them; each must be dropped, or the person completing must confirm them one by one with a reason. A trip still `running` 90 minutes past its usual end alerts the transport manager.
- **R-transport-10** A pickup trip ends at the school: completing it drops every boarded rider at once after the attendant confirms the vehicle was checked for sleeping children; the confirmation is recorded.
- **R-transport-11** With `transport.named_handover`, dropping a young child needs the name of the adult who received them.
- **R-transport-12** Guardians are told when their child boards and is dropped, by the settings. A guardian sees the vehicle's position only while a trip of their child's route is running, and never other children's names.
- **R-transport-13** Positions arrive from the tracker ([M05](m05-integrations-api.md)) or the driver's phone. They update the vehicle's last position and are kept 90 days. A speed above `transport.speed_alert_kmh` for more than a minute alerts the transport manager.
- **R-transport-14** Thirty and seven days before a vehicle's fitness, insurance, permit or token tax, or a driver's licence, expires, the transport manager is reminded; the items also appear in the compliance calendar ([M25](m25-tax-compliance.md)).
- **R-transport-15** A vehicle `in_workshop` cannot be put on a trip.
- **R-transport-16** A fuel log's odometer cannot go backwards; km per litre is computed against the previous fill and a figure 30% outside the vehicle's average is flagged.
- **R-transport-17** Fuel and maintenance costs become expenses in [M24](m24-expenses-procurement.md) when "record as expense" is chosen; this module links to them and never posts to the ledger itself.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `transport:read` | See vehicles, routes, riders, trips and positions | transport_manager, LEADERS, FRONT, security_guard |
| `transport-setup:manage` | Maintain vehicles, drivers, routes and stops | transport_manager |
| `transport-assignments:manage` | Assign and remove riders; decide requests | transport_manager, branch_admin |
| `trips:operate` | Run one's own trips and record events | driver |
| `trips:manage` | Change any trip; record events for any trip; set replacements | transport_manager |
| `vehicle-costs:manage` | Record fuel and maintenance | transport_manager, driver |
| `transport:export` | Export transport reports | transport_manager, LEADERS |

A staff member named as a trip's attendant may record its events without the `driver` role.

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/vehicles` | `transport:read` | Lists |
| POST | `/vehicles` | `transport-setup:manage` | Creates |
| GET | `/vehicles/[id]` | `transport:read` | One vehicle with documents and costs |
| PATCH | `/vehicles/[id]` | `transport-setup:manage` | Edits |
| GET | `/drivers` | `transport:read` | Lists |
| PUT | `/drivers` | `transport-setup:manage` | Saves a staff member's driving details |
| GET | `/transport-routes` | `transport:read` | Lists with rider counts against seats |
| POST | `/transport-routes` | `transport-setup:manage` | Creates |
| GET | `/transport-routes/[id]` | `transport:read` | The route sheet |
| PATCH | `/transport-routes/[id]` | `transport-setup:manage` | Edits |
| PUT | `/transport-routes/[id]/stops` | `transport-setup:manage` | Saves the stops in order |
| GET | `/transport-assignments` | `transport:read` | Lists; filter by route, stop, grade |
| POST | `/transport-assignments` | `transport-assignments:manage` | Assigns a rider |
| PATCH | `/transport-assignments/[id]` | `transport-assignments:manage` | Changes stop or direction |
| POST | `/transport-assignments/[id]/end` | `transport-assignments:manage` | Ends from a date |
| GET | `/transport-requests` | `transport:read` | Lists; pending first |
| POST | `/transport-requests/[id]/decide` | `transport-assignments:manage` | Approves or rejects |
| GET | `/trips` | `transport:read` | Lists; filter by date, route, status |
| GET | `/trips/today` | `trips:operate` | My trips today |
| GET | `/trips/[id]` | `transport:read` | The manifest and progress |
| PATCH | `/trips/[id]` | `trips:manage` | Sets a replacement vehicle, driver or attendant; cancels |
| POST | `/trips/[id]/start` | `trips:operate` | Starts |
| POST | `/trips/[id]/events` | `trips:operate` | Records boarding, drop or no-show for one or more riders |
| POST | `/trips/[id]/complete` | `trips:operate` | Completes, with the checks in R-transport-9 and 10 |
| POST | `/trips/[id]/positions` | `trips:operate` | Uploads positions from the driver's phone |
| GET | `/transport/live` | `transport:read` | Vehicles on running trips with their positions |
| GET | `/vehicles/[id]/maintenance` | `transport:read` | Lists |
| POST | `/vehicles/[id]/maintenance` | `vehicle-costs:manage` | Records |
| GET | `/fuel-logs` | `transport:read` | Lists |
| POST | `/fuel-logs` | `vehicle-costs:manage` | Records |
| GET | `/transport/costs` | `transport:read` | Fleet cost |
| GET | `/transport/export` | `transport:export` | Exports |
| GET | `/family/children/[id]/transport` | `signed-in` | A child's transport |
| POST | `/family/transport-requests` | `signed-in` | Asks to start, change or stop transport |
| GET | `/public/[school]/transport-routes` | `public` | Routes and stops, without fares unless the school shows them |

Idempotent: `POST /trips/[id]/start`, `POST /trips/[id]/events`, `POST /trips/[id]/complete`, `POST /transport-assignments`.

## 8 · Client layer

Custom hooks: `useRouteSheet`, `useSaveStops`, `useAssignRider`, `useTransportRequests`, `useMyTripsToday`, `useTripManifest`, `useRecordTripEvent` (optimistic, queued offline), `useCompleteTrip`, `useLiveFleet` (Realtime, falling back to polling every 20 seconds), `useFleetCost`, `useChildTransport`.

## 9 · Screens

Built in [Phase 11](../20-phases/phase-11-front-office-and-operations.md) and [Phase 14](../20-phases/phase-14-family-portals.md). The driver's screens are web pages sized for a phone now, and the driver app in [Phase 23](../20-phases/phase-23-mobile-apps.md).

| Screen | Pattern | Where |
|---|---|---|
| Fleet | List + Detail | `/school/transport/vehicles`: documents with expiry chips; cost tab |
| Routes | List + Detail | Riders against seats; stops in order with a map; assign riders |
| Riders | List | By route and stop; requests tab |
| Today | Dashboard | Each trip as a row: status, boarded of expected, last position; a map of running trips |
| Trip | Detail | The manifest; events as they happen; replace vehicle or driver |
| Costs | Report | Cost per km and per rider by vehicle and month |
| **Driver / attendant:** My trips | List | Today's two trips; Start |
| **Driver / attendant:** Manifest | Checklist | Stops in order; large rows with photo and name; one tap to board, one to drop; riders not riding greyed with the reason; a banner until every boarded child is dropped |
| **Parent:** Transport | Detail | Route, stop and timings; today's state; the bus on a map during a trip; ask for a change |

## 10 · Notifications and jobs

Events: `transport.boarded`, `transport.dropped`, `transport.no-show` (to the guardian, pickup only), `transport.trip-started` (optional), `transport.delay` (a trip started more than 15 minutes late), `transport.not-dropped` (to the transport manager, urgent), `transport.trip-overdue`, `transport.speeding`, `transport.document-expiring`, `transport.request-received`, `transport.request-decided`, `transport.assignment-changed`.

Jobs: `transport.create-trips` (daily 04:00), `transport.overdue-check` (every 5 minutes while trips run), `transport.document-reminders` (daily 08:00), `transport.purge-locations` (daily; drops partitions older than 90 days), `transport.end-assignments` (daily: students who left).

Documents: route sheet with riders, vehicle rider list, transport ID tag, fleet cost report.

## 11 · Offline

Offline-writable in the driver and attendant screens, through a `transport.trips` stream (the day's own trips and their riders):

| Table | Operation | Conflict policy |
|---|---|---|
| `trip_events` | create | Always added; the unique rule merges a repeat |
| `trips` | update (start, complete) | Latest write wins; completion is re-checked on the server and reopened with an alert if a boarded rider has no drop |
| `vehicle_locations` | create | Always added |

## 12 · AI

None. Route planning and timings are set by people; a later version may suggest stop order from coordinates with a plain distance calculation.

## 13 · Failure cases

- **F-transport-1** The attendant completes the afternoon trip with one child still marked boarded → refused; the child's name is shown; the transport manager is alerted if it is not resolved in 5 minutes.
- **F-transport-2** The driver's phone has no signal for the whole trip → events are kept on the phone and uploaded later; guardians get their messages late, marked with the real time.
- **F-transport-3** The bus breaks down → the transport manager sets a replacement vehicle on the trip; riders and events stay; guardians of the route are told of the delay.
- **F-transport-4** A 31st rider is assigned to a 30-seat van → refused with the count, or warned, by the setting.
- **F-transport-5** A child is absent from school → greyed on the drop manifest; if the attendant boards them anyway, the event is accepted and the class teacher is told the attendance may be wrong.
- **F-transport-6** A guardian asks to change stop mid-month → approved from a date; the fare changes from the next month's voucher unless the accountant prorates.
- **F-transport-7** The tracker reports a position 300 km away → positions that jump faster than 150 km/h from the last one are discarded and counted.
- **F-transport-8** A driver's licence expired yesterday → they cannot start a trip; the manager must set another driver.
- **F-transport-9** Two attendants record the same boarding → one event.
- **F-transport-10** A holiday is declared late → the day's trips are cancelled by the job when the holiday is saved; a note goes to route guardians.

## 14 · Seed data

Per branch with transport: 4 to 6 vehicles (one in the workshop, one with insurance expiring), drivers and attendants, 4 to 6 routes with 6 to 10 stops each, about 35% of students assigned (one route full). Three weeks of trips with events, including a late trip and a no-show. Position trails for the last two days. Fuel logs and maintenance for three months. Five transport requests, two pending.

## 15 · Tests

- **T-transport-1** Capacity rule in both modes.
- **T-transport-2** Assignment creates and closes the fee item; one-way fare; change of stop.
- **T-transport-3** Request approval makes the assignment; guardians act only for their own child.
- **T-transport-4** Daily trip creation skips holidays and non-working days.
- **T-transport-5** Manifest states from attendance, gate passes and leave.
- **T-transport-6** Only the trip's crew records events; one event of each kind per rider.
- **T-transport-7** Completion is refused with an undropped rider; the confirm path records reasons.
- **T-transport-8** Expired licence and workshop vehicle block a trip.
- **T-transport-9** A guardian gets the position only during their child's running trip and never another child's data.
- **T-transport-10** Offline events apply once; server re-check on completion.
- **T-transport-11** Position sanity filter and retention.
- **T-transport-12** Fuel odometer and efficiency flag.
- **T-transport-13** Row-level security and branch scope.
