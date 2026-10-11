# M11 · Academic structure

## 1 · Purpose

The shape of teaching: grades, sections, subjects, which subjects each grade studies, who teaches what to whom, and the subject groups of Grades 9 and 10. The timetable, attendance, homework, exams and results all build on these rows.

## 2 · Depends on

[M02](m02-organisation-branches.md), [M04](m04-school-setup.md), [M26](m26-staff-recruitment.md) (`staff`). Students come from [M07](m07-students.md).

## 3 · Tables

#### `grades` · org

| Column | Type | Rules |
|---|---|---|
| level | int | required; 1 to 10 |
| name | text | required; `Grade 8` |
| name_ur | text | optional |
| short_name | text | required; `8` |
| stage | enum(primary, middle, secondary) | required; 1–5, 6–8, 9–10 |
| next_grade_id | uuid → grades | optional; empty for Grade 10 |
| grading_scheme_id | uuid → grading_schemes | required; the default for this grade |
| is_offered | bool | default true |

Policy: every member of the organisation may read; staff write, by permission.
Unique: (org_id, level).

#### `sections` · branch
A class for one academic year: "8-B".

| Column | Type | Rules |
|---|---|---|
| academic_year_id | uuid → academic_years | required |
| grade_id | uuid → grades | required |
| name | text | required; `A`, `B`, `Blue` |
| capacity | int | required; > 0; default 40 |
| class_teacher_id | uuid → staff | optional |
| room_id | uuid → rooms | optional |
| shift_id | uuid → shifts | optional |
| wing_id | uuid → wings | optional |
| medium | enum(english, urdu) | default english |
| gender | enum(boys, girls, mixed) | default mixed |
| roll_number_rule | enum(alphabetical, admission_order, girls_first, manual) | default alphabetical |
| status | enum(active, closed) | default active |

Policy: every member of the organisation may read, because a family sees the name of their child's class; which sections a user is shown is decided by the service. Staff of the branch write, by permission.
Unique: (branch_id, academic_year_id, grade_id, name) among live rows.
Index: (org_id, branch_id, academic_year_id, grade_id).

#### `subjects` · org

| Column | Type | Rules |
|---|---|---|
| code | text | required; `ENG`, `MATH`, `ISL` |
| name | text | required |
| name_ur | text | optional |
| kind | enum(core, language, religious, elective, activity) | default core |
| has_practical | bool | default false |
| alternative_of_id | uuid → subjects | optional; Ethics is the alternative of Islamiyat |
| is_active | bool | default true |

Policy: every member of the organisation may read; staff write, by permission.
Unique: (org_id, code) among live rows.

#### `subject_groups` · org
The streams of Grades 9 and 10.

| Column | Type | Rules |
|---|---|---|
| key | text | required; `science_bio`, `science_cs`, `humanities` |
| name | text | required |
| name_ur | text | optional |
| is_active | bool | default true |

Policy: every member of the organisation may read; staff write, by permission.
Unique: (org_id, key) among live rows.

#### `grade_subjects` · org
The curriculum: which subjects a grade studies in a year, and how they are marked.

| Column | Type | Rules |
|---|---|---|
| academic_year_id | uuid → academic_years | required |
| grade_id | uuid → grades | required |
| subject_id | uuid → subjects | required |
| subject_group_id | uuid → subject_groups | optional; set when only one stream takes it |
| is_compulsory | bool | default true |
| periods_per_week | int | required; ≥ 0 |
| theory_marks | numeric(6,2) | required; ≥ 0 |
| practical_marks | numeric(6,2) | default 0 |
| pass_percent | numeric(5,2) | optional; overrides the grading scheme |
| counts_in_result | bool | default true |
| book_title | text | optional |
| sort_order | int | default 0 |

Policy: every member of the organisation may read, because timetables, homework and results name the subjects of a class; staff write, by permission.
Unique: (academic_year_id, grade_id, subject_id, subject_group_id) among live rows.

#### `section_subjects` · branch
Who teaches a subject to a section.

| Column | Type | Rules |
|---|---|---|
| section_id | uuid → sections | required |
| grade_subject_id | uuid → grade_subjects | required |
| teacher_id | uuid → staff | optional until assigned |
| periods_per_week | int | optional; overrides the curriculum's figure |

Policy: every member of the organisation may read, because a family sees who teaches their child and may message only those teachers; staff of the branch write, by permission.
Unique: (section_id, grade_subject_id) among live rows.
Index: (org_id, teacher_id).

#### `student_subject_overrides` · branch +family
Exceptions to the subjects a student would normally take.

| Column | Type | Rules |
|---|---|---|
| enrollment_id | uuid → enrollments | required |
| student_id | uuid → students | required |
| grade_subject_id | uuid → grade_subjects | required |
| action | enum(add, drop) | required |
| reason | enum(religion_alternative, elective_choice, medical_exemption, other) | required |
| note | text | optional |

Unique: (enrollment_id, grade_subject_id).

## 4 · Contracts

`packages/contracts/src/modules/academics/`: `grades`, `sections`, `subjects`, `subject-groups`, `grade-subjects`, `section-subjects`, `student-subject-overrides`, `teacher-assignments`.

- `Section` (entity) includes `displayName` ("8-B"), `gradeLevel`, `classTeacherName`, `studentCount`.
- `SetCurriculum`: `{ academicYearId, gradeId, items: GradeSubjectInput[], version }` — a grade's whole subject list is saved together.
- `AssignTeachers`: `{ items: { sectionSubjectId, teacherId | null }[] }`.
- `TeacherAssignments`: for one teacher, their sections and subjects with weekly periods and total load.
- Pure function `subjectsFor(enrollment, gradeSubjects, overrides)` returns the subjects a student takes. It is exported from contracts and used by exams, results and report cards.

## 5 · Rules

- **R-academics-1** An organisation has exactly ten grade rows, levels 1 to 10, created at provisioning. A grade can be marked not offered but not deleted.
- **R-academics-2** A section belongs to one academic year. New years get their sections by rollover ([M04](m04-school-setup.md)).
- **R-academics-3** A class teacher must be an active teaching member of staff with access to the section's branch. By default a teacher is class teacher of at most one section per shift; `sections:override` allows more.
- **R-academics-4** Assigning a class teacher gives that staff member the `class_teacher` role if they lack it. Removing their last section does not remove the role; a daily job reports class-teacher roles with no section.
- **R-academics-5** Creating a section creates one `section_subjects` row for each of the grade's subjects that applies to it, with no teacher.
- **R-academics-6** A grade's curriculum for a year cannot change `theory_marks`, `practical_marks` or `counts_in_result` once an exam paper for that subject has marks entered. Other fields can change.
- **R-academics-7** A subject that belongs to a subject group is taken only by students in that group. A compulsory subject without a group is taken by everyone in the grade.
- **R-academics-8** `subjectsFor`: compulsory subjects of the grade, plus the student's group's subjects, plus `add` overrides, minus `drop` overrides.
- **R-academics-9** When a student whose religion is not Islam is enrolled in a grade that has Islamiyat with an alternative subject, overrides are created automatically: drop Islamiyat, add the alternative. Staff can reverse them.
- **R-academics-10** A subject group applies only to Grades 9 and 10. Enrolling a student there requires a group; changing it after the first exam of the year needs `enrollments:update` and a reason.
- **R-academics-11** A teacher's weekly load is the sum of periods of their `section_subjects`. Exceeding the setting `timetable.max_periods_per_week` warns at assignment.
- **R-academics-12** A section with enrolled students cannot be deleted. It can be closed at year end, or its students moved first.
- **R-academics-13** A subject used by any `grade_subjects` row cannot be deleted; it can be made inactive, which hides it from new curricula.
- **R-academics-14** Removing a teacher from a `section_subjects` row that has future timetable entries warns, and on confirmation clears the teacher on those entries.
- **R-academics-15** A teacher's scope everywhere in the product is: sections where they are class teacher, plus sections where they hold a `section_subjects` row, plus sections they are substituting in today.

## 6 · Permissions

| Permission | Allows | Default roles |
|---|---|---|
| `grades:read` | See grades | ALL_STAFF, FAMILY |
| `grades:update` | Rename grades; set the default grading scheme; mark offered | principal, academic_head |
| `sections:read` | See sections | ALL_STAFF |
| `sections:create` | Add a section | ADMINS, academic_head, section_head, coordinator |
| `sections:update` | Edit a section; set class teacher and room | ADMINS, academic_head, section_head, coordinator |
| `sections:delete` | Delete an empty section | ADMINS |
| `sections:override` | Give a teacher a second class | principal |
| `subjects:read` | See subjects and subject groups | ALL_STAFF, FAMILY |
| `subjects:update` | Create and edit subjects and subject groups | principal, academic_head |
| `curriculum:read` | See each grade's subjects and marks | ALL_STAFF |
| `curriculum:update` | Set each grade's subjects and marks | principal, academic_head, coordinator |
| `teacher-assignments:read` | See who teaches what | ALL_STAFF |
| `teacher-assignments:update` | Assign teachers to subjects | ADMINS, ACADEMIC |
| `student-subjects:update` | Add or drop a subject for a student | ADMINS, ACADEMIC |

## 7 · Routes

| Method | Path | Permission | Does |
|---|---|---|---|
| GET | `/grades` | `grades:read` | Lists grades |
| PATCH | `/grades/[id]` | `grades:update` | Edits a grade |
| GET | `/sections` | `sections:read` | Lists sections; filter by year, branch, grade, teacher |
| POST | `/sections` | `sections:create` | Creates a section with its subject rows |
| GET | `/sections/[id]` | `sections:read` | One section with counts |
| PATCH | `/sections/[id]` | `sections:update` | Edits |
| DELETE | `/sections/[id]` | `sections:delete` | Deletes an empty section |
| POST | `/sections/[id]/close` | `sections:update` | Closes at year end |
| GET | `/sections/[id]/subjects` | `teacher-assignments:read` | The section's subjects and teachers |
| PUT | `/sections/[id]/subjects` | `teacher-assignments:update` | Assigns teachers |
| GET | `/sections/[id]/students` | `students:read` | The section's students in roll-number order |
| GET | `/subjects` | `subjects:read` | Lists subjects |
| POST | `/subjects` | `subjects:update` | Creates |
| PATCH | `/subjects/[id]` | `subjects:update` | Edits |
| DELETE | `/subjects/[id]` | `subjects:update` | Deletes an unused subject |
| GET | `/subject-groups` | `subjects:read` | Lists subject groups |
| POST | `/subject-groups` | `subjects:update` | Creates |
| PATCH | `/subject-groups/[id]` | `subjects:update` | Edits |
| GET | `/curriculum` | `curriculum:read` | A grade's subjects for a year |
| PUT | `/curriculum` | `curriculum:update` | Saves a grade's subject list |
| POST | `/curriculum/copy` | `curriculum:update` | Copies a grade's curriculum from another year |
| GET | `/teacher-assignments` | `teacher-assignments:read` | All assignments with loads, for the branch |
| GET | `/teacher-assignments/[staffId]` | `teacher-assignments:read` | One teacher's sections, subjects and load |
| GET | `/student-subject-overrides` | `students:read` | Overrides for a student or a section |
| POST | `/student-subject-overrides` | `student-subjects:update` | Adds an override |
| DELETE | `/student-subject-overrides/[id]` | `student-subjects:update` | Removes |
| GET | `/students/[id]/subjects` | `students:read` | The subjects this student takes this year |
| GET | `/teach/sections` | `signed-in` | The signed-in teacher's own sections and subjects |
| GET | `/family/children/[id]/subjects` | `signed-in` | A child's subjects and teachers |

## 8 · Client layer

Generated CRUD for `sections`, `subjects`, `subject-groups`. Custom hooks: `useGrades`, `useCurriculum(yearId, gradeId)`, `useSaveCurriculum`, `useSectionSubjects`, `useAssignTeachers`, `useTeacherAssignments`, `useMySections` (teacher portal; drives every teacher screen), `useStudentSubjects`.

Pickers in `@takhti/ui` (`GradePicker`, `SectionPicker`, `SubjectPicker`) are fed by these hooks and respect the user's scope.

## 9 · Screens

Under `/school/academics/structure`. Built in [Phase 7](../20-phases/phase-07-school-setup-and-people.md).

| Screen | Pattern | Notes |
|---|---|---|
| Classes | List grouped by grade | Each section: students of capacity, class teacher, room; add section |
| Section | Detail | Tabs: Students, Subjects and teachers, Timetable, Attendance, Results |
| Subjects | List + Dialog form | Urdu name, practical flag, alternative |
| Curriculum | Grid editor | One grade at a time: subjects against periods, theory and practical marks; copy from last year |
| Subject groups | List + Dialog form | Which Grade 9–10 subjects belong to each |
| Teacher assignments | Grid editor | Sections down, subjects across, a teacher in each cell; unassigned cells highlighted; load per teacher at the side |
| Teacher load | List | Periods per week per teacher, over-limit flagged |

## 10 · Notifications and jobs

Events: `section.created`, `section.class-teacher-changed` (to the old and new teacher), `teacher-assignment.changed`.

Jobs: `academics.unassigned-report` (weekly: subjects with no teacher, class-teacher roles with no section).

## 11 · Offline

Read-only in `teacher.sections`: the teacher's sections, their subjects and each student's subject list.

## 12 · AI

None directly. Curriculum and assignments feed timetable auto-fill (S6) and the planning tools (A2 to A4).

## 13 · Failure cases

- **F-academics-1** A curriculum is saved by two coordinators at once → the second gets `STALE`.
- **F-academics-2** Theory marks are changed after marks were entered → `RULE` naming the exam and paper.
- **F-academics-3** A teacher is assigned who has left → refused; only active staff appear in the picker and the service checks again.
- **F-academics-4** A section is deleted while a teacher is marking its attendance offline → the delete is refused because students are enrolled.
- **F-academics-5** A student in Grade 9 has no subject group → enrolment refuses it; an integrity check lists any that slip through an import.
- **F-academics-6** Islamiyat's alternative is not offered in a grade → the automatic override is skipped and the student appears in the "needs a subject decision" list.
- **F-academics-7** Copying a curriculum from a year that has none → `RULE` "Grade 6 has no subjects in 2025–26".

## 14 · Seed data

Ten grades. Subjects: English, Urdu, Mathematics, General Science, Social Studies, Islamiyat, Ethics (alternative), Nazra, Computer, Pakistan Studies, Physics, Chemistry, Biology, Computer Science, General Mathematics, Drawing, Physical Education. Three subject groups. A curriculum for every grade in both years. Main Campus: 2 sections per grade, with a Science–Biology and a Science–Computer section in each of Grades 9 and 10; City Campus: 2 per grade for Grades 1–5 and 1 for Grades 6–8. Every section has a class teacher and every subject a teacher, except four deliberately unassigned cells.

## 15 · Tests

- **T-academics-1** Ten grades exist and cannot be deleted.
- **T-academics-2** Section uniqueness; creation makes subject rows.
- **T-academics-3** Class teacher rules: active, branch access, one per shift, override; role granted.
- **T-academics-4** Curriculum lock after marks exist.
- **T-academics-5** `subjectsFor` with groups, add and drop overrides, and the religion alternative.
- **T-academics-6** Grade 9 enrolment needs a group.
- **T-academics-7** Teacher scope: class teacher, subject teacher, substitute today, none.
- **T-academics-8** Deleting a section with students, and a subject in use, is refused.
- **T-academics-9** Load warning at the limit.
- **T-academics-10** Row-level security and branch scope.
