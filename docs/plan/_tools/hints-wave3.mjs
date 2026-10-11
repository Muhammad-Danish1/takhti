// Wave 3 · Academics: M12 timetable, M13 syllabus, M14 attendance, M15 homework, M19 question bank,
// M16 learning, M17 exams, M18 results, M20 behaviour. See scaffold-hints.mjs for what each field means.

const live = '${t.deletedAt} is null';
const isStaff = '${policySql.isStaff}';

/** A restrictive policy: the row is reachable only by someone who can reach its parent. */
const follows = (table, name, parent, column, options = {}) => {
  const seen = `exists (select 1 from ${parent} p where p.id = \${t.${column}}${options.and ? ` and ${options.and}` : ''})`;
  const condition = options.staffToo ? seen : `${isStaff} or ${seen}`;
  return (
    `customPolicy('${table}_${name}', { for: '${options.for ?? 'select'}', restrictive: true, using: sql\`${condition}\`` +
    (options.for === 'all' ? `, withCheck: sql\`${condition}\`` : '') +
    ' })'
  );
};

export const wave3 = {
  // ------------------------------------------------------------------ M12 · Timetable

  // A family's timetable shows lesson times, so members read the schedules in force.
  bell_schedules: {
    meta: { member: { read: { status: 'active' } } },
    columns: {
      valid_to: { checks: [{ suffix: 'from', sql: '${t.validTo} >= ${t.validFrom}' }] },
      weekdays: {
        checks: [
          {
            suffix: 'days',
            sql: "cardinality(${t.weekdays}) >= 1 and ${t.weekdays} <@ array['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']",
          },
        ],
      },
      lesson_count: { checks: ["positive('bell_schedules', t.lessonCount)"] },
    },
    fixture: "() => ({ weekdays: ['mon', 'tue', 'wed', 'thu', 'fri'] })",
  },
  bell_periods: {
    meta: { member: 'read' },
    columns: {
      sequence: { checks: ["positive('bell_periods', t.sequence)"] },
      lesson_no: {
        checks: [
          "positive('bell_periods', t.lessonNo)",
          // A lesson has a number; a break, an assembly or a prayer does not.
          { suffix: 'kind', sql: "(${t.kind} = 'lesson') = (${t.lessonNo} is not null)" },
        ],
      },
    },
    lines: [
      {
        match: 'Periods of one schedule must not overlap',
        sql: "alter table bell_periods add constraint bell_periods_no_overlap exclude using gist (bell_schedule_id with =, tsrange('2000-01-01'::date + start_time, '2000-01-01'::date + end_time) with &&) where (deleted_at is null)",
      },
    ],
    fixture: "(_place, index) => ({ kind: 'break', startTime: clock(index), endTime: clock(index, 30) })",
  },
  timetables: {
    meta: { member: { read: { status: 'published' } } },
    columns: {
      effective_to: { checks: [{ suffix: 'from', sql: '${t.effectiveTo} >= ${t.effectiveFrom}' }] },
    },
    lines: [
      {
        match: 'At most one `published` timetable per (branch, shift)',
        sql: "alter table timetables add constraint timetables_one_published exclude using gist (branch_id with =, shift_id with =, daterange(effective_from, effective_to, '[]') with &&) where (status = 'published' and deleted_at is null)",
      },
    ],
  },
  // An entry carries no state of its own; the service serves only the entries of the published timetable.
  timetable_entries: {
    meta: { member: 'read' },
    lines: [{ match: 'The last two make a double booking impossible', note: true }],
  },
  teacher_availability: {
    columns: { lesson_no: { checks: ["positive('teacher_availability', t.lessonNo)"] } },
  },
  substitutions: {
    columns: { lesson_no: { checks: ["positive('substitutions', t.lessonNo)"] } },
  },

  // ------------------------------------------------------------------ M13 · Syllabus and lesson plans

  // Students see the syllabus of their subjects.
  syllabus_units: {
    meta: { member: { read: { status: 'active' } } },
    columns: {
      estimated_periods: { checks: ["nonNegative('syllabus_units', t.estimatedPeriods)"] },
    },
    lines: [
      { match: 'A parent must belong to the same `grade_subject_id`', service: true },
      { match: 'Depth is at most three', service: true },
    ],
  },
  learning_outcomes: { meta: { member: 'read' } },
  schemes_of_work: {
    // A scheme for "every section of the grade" has no section; there must still be only one.
    lines: [{ match: '(branch_id, term_id, grade_subject_id, section_id)', nulls: 'same' }],
  },
  scheme_weeks: {
    columns: {
      end_date: { checks: [{ suffix: 'from', sql: '${t.endDate} >= ${t.startDate}' }] },
      periods_planned: { checks: ["nonNegative('scheme_weeks', t.periodsPlanned)"] },
    },
  },
  syllabus_progress: {
    columns: { periods_used: { checks: ["nonNegative('syllabus_progress', t.periodsUsed)"] } },
  },
  lesson_plans: {
    columns: { lesson_no: { checks: ["positive('lesson_plans', t.lessonNo)"] } },
  },

  // ------------------------------------------------------------------ M14 · Student attendance

  attendance_sessions: {
    columns: { lesson_no: { checks: ["nonNegative('attendance_sessions', t.lessonNo)"] } },
  },
  student_leave_requests: {
    // A guardian asks from the portal, and may withdraw the request while nobody has decided it.
    meta: {
      familyRule: { read: true, insert: { status: 'pending' }, update: { status: 'pending' } },
    },
    columns: {
      to_date: { checks: [{ suffix: 'span', sql: '${t.toDate} <= ${t.fromDate} + 30' }] },
    },
  },

  // ------------------------------------------------------------------ M15 · Homework and diary

  // Published homework is read by the school's members; the service shows a family its own children's sections.
  homework: {
    meta: { member: { read: { status: ['published', 'closed'] } } },
    columns: {
      max_marks: { checks: ["positive('homework', t.maxMarks)"] },
      // "homeworkSubmissions" is the name of a table: this list says how the work is handed in.
      submission: {
        enum: { constName: 'homeworkSubmissionModes', typeName: 'HomeworkSubmissionMode' },
      },
    },
  },
  homework_submissions: {
    meta: {
      familyRule: {
        read: true,
        insert: { status: ['pending', 'submitted', 'late'] },
        update: { status: ['pending', 'submitted', 'late', 'returned'] },
      },
    },
    columns: { marks: { checks: ["nonNegative('homework_submissions', t.marks)"] } },
  },
  diary_entries: {
    meta: { member: { read: { status: 'published' } } },
    // The class teacher's general note has no subject; there is one such note a day.
    lines: [{ match: '(section_id, entry_date, section_subject_id)', nulls: 'same' }],
  },
  diary_acknowledgements: { meta: { familyRule: 'append' } },

  // ------------------------------------------------------------------ M16 · Learning

  learning_resources: {
    meta: { member: { read: { status: 'published', audience: 'students' } } },
    columns: {
      url: {
        accounted: 'check',
        checks: [
          { suffix: 'needed', sql: "${t.kind} not in ('link', 'video') or ${t.url} is not null" },
          { suffix: 'https', sql: "${t.url} like 'https://%'" },
        ],
      },
      body: {
        accounted: 'check',
        checks: [{ suffix: 'needed', sql: "${t.kind} <> 'note' or ${t.body} is not null" }],
      },
      file_id: {
        accounted: 'check',
        checks: [{ suffix: 'needed', sql: "${t.kind} <> 'file' or ${t.fileId} is not null" }],
      },
    },
    fixture: "() => ({ kind: 'note', body: 'A short note for the class.' })",
  },
  resource_views: { meta: { familyRule: 'append' } },
  quizzes: {
    meta: { member: { read: { status: ['published', 'closed'] } } },
    columns: {
      section_ids: {
        accounted: 'check',
        checks: [{ suffix: 'some', sql: 'cardinality(${t.sectionIds}) >= 1' }],
      },
      duration_minutes: { checks: ["positive('quizzes', t.durationMinutes)"] },
      pass_percent: { checks: ["between('quizzes', t.passPercent, 0, 100)"] },
    },
    fixture:
      '(_place, index) => ({ sectionIds: [crypto.randomUUID()], opensAt: hour(index * 3), closesAt: hour(index * 3 + 1) })',
  },
  quiz_questions: { policy: 'template' },
  quiz_attempts: {
    // A student starts an attempt and hands it in; once it is in, only staff touch it.
    meta: {
      familyRule: { read: true, insert: { status: 'in_progress' }, update: { status: 'in_progress' } },
    },
    columns: { attempt_no: { checks: ["positive('quiz_attempts', t.attemptNo)"] } },
  },
  // Whether answers may still change depends on the attempt, not on this row: the service checks
  // the attempt's state and deadline before every write.
  quiz_answers: { meta: { familyRule: { read: true, insert: true, update: true } } },
  live_classes: {
    meta: { member: 'read' },
    columns: {
      join_url: { checks: [{ suffix: 'https', sql: "${t.joinUrl} like 'https://%'" }] },
    },
    fixture:
      "(_place, index) => ({ joinUrl: 'https://meet.example.test/takhti', startsAt: hour(index * 3), endsAt: hour(index * 3 + 1) })",
  },

  // ------------------------------------------------------------------ M17 · Exams and marks

  exam_types: {
    columns: { default_weight: { checks: ["between('exam_types', t.defaultWeight, 0, 100)"] } },
  },
  exams: {
    // Families read an exam once its date sheet is out; the service adds "and their child's grade takes it".
    meta: { member: { read: { datesheetPublishedAt: { set: true } } } },
    // The date marks are due is worked out by the service from a setting.
    columns: { marks_due_on: { default: '' } },
  },
  exam_grades: { meta: { member: 'read' } },
  exam_papers: {
    meta: { member: { read: { status: ['scheduled', 'conducted'] } } },
    columns: {
      paper_date: {
        checks: [
          {
            suffix: 'needed',
            sql: "${t.status} not in ('scheduled', 'conducted') or (${t.paperDate} is not null and ${t.startTime} is not null)",
          },
        ],
      },
      pass_marks: { checks: ["nonNegative('exam_papers', t.passMarks)"] },
    },
    fixture:
      '(_place, index) => ({ maxMarks: 2, passMarks: 1, paperDate: day(index), startTime: clock(index), endTime: clock(index, 30) })',
  },
  mark_entries: {
    columns: {
      marks: {
        accounted: 'check',
        checks: [
          { suffix: 'needed', sql: "${t.status} <> 'present' or ${t.marks} is not null" },
          "nonNegative('mark_entries', t.marks)",
        ],
      },
    },
    fixture: '() => ({ marks: 10 })',
  },

  // ------------------------------------------------------------------ M19 · Question bank and papers

  questions: {
    policy: 'template',
    columns: {
      options: {
        accounted: 'check',
        checks: [
          {
            suffix: 'needed',
            sql: "${t.type} not in ('mcq', 'match') or ${t.options} <> '[]'::jsonb",
          },
        ],
      },
      times_used: { checks: ["nonNegative('questions', t.timesUsed)"] },
    },
    fixture: "() => ({ type: 'short', marks: 1 })",
  },
  paper_blueprints: {
    columns: {
      total_marks: { checks: ["positive('paper_blueprints', t.totalMarks)"] },
      duration_minutes: { checks: ["positive('paper_blueprints', t.durationMinutes)"] },
    },
  },
  // A paper is confidential until its exam date. Before that only its writer reads it, and holders
  // of the `papers` capability: those who approve papers or may see them all.
  question_papers: {
    meta: { custom: true },
    columns: {
      total_marks: { checks: ["positive('question_papers', t.totalMarks)"] },
      duration_minutes: { checks: ["positive('question_papers', t.durationMinutes)"] },
    },
    extra: [
      "customPolicy('question_papers_confidential', { for: 'all', restrictive: true, " +
        "using: sql`not (${t.isConfidential} and (${t.opensOn} is null or ${t.opensOn} > (select app.today()))) or (select app.has_cap('papers')) or ${t.createdByStaffId} = (select app.staff_id())`, " +
        "withCheck: sql`not (${t.isConfidential} and (${t.opensOn} is null or ${t.opensOn} > (select app.today()))) or (select app.has_cap('papers')) or ${t.createdByStaffId} = (select app.staff_id())` })",
    ],
  },
  paper_sections: {
    meta: { custom: true },
    extra: [follows('paper_sections', 'follows_paper', 'question_papers', 'questionPaperId', { for: 'all', staffToo: true })],
  },
  paper_questions: {
    meta: { custom: true },
    columns: { marks: { checks: ["positive('paper_questions', t.marks)"] } },
    extra: [follows('paper_questions', 'follows_paper', 'question_papers', 'questionPaperId', { for: 'all', staffToo: true })],
  },

  // ------------------------------------------------------------------ M18 · Results and report cards

  result_policies: {
    columns: {
      min_aggregate_percent: { checks: ["between('result_policies', t.minAggregatePercent, 0, 100)"] },
      compartment_max_subjects: { checks: ["nonNegative('result_policies', t.compartmentMaxSubjects)"] },
      grace_marks_total: { checks: ["nonNegative('result_policies', t.graceMarksTotal)"] },
      grace_marks_per_subject: { checks: ["nonNegative('result_policies', t.graceMarksPerSubject)"] },
      grace_max_subjects: { checks: ["nonNegative('result_policies', t.graceMaxSubjects)"] },
    },
  },
  result_sets: {
    meta: { member: { read: { status: 'published' } } },
    columns: {
      exam_id: {
        accounted: 'check',
        checks: [{ suffix: 'needed', sql: "${t.kind} <> 'exam' or ${t.examId} is not null" }],
      },
    },
    fixture: "() => ({ kind: 'term' })",
  },
  result_set_components: {
    columns: {
      weight_percent: {
        // That a set's weights total 100 is checked by the service when the set is computed.
        accounted: 'service',
        checks: [{ suffix: 'max', sql: '${t.weightPercent} <= 100' }],
      },
    },
  },
  // A family reads its child's result only once the result set is published. A withheld result is
  // still readable as a row: the service then returns only the fact and the note.
  results: {
    meta: { custom: true },
    columns: {
      failed_subjects: { checks: ["nonNegative('results', t.failedSubjects)"] },
      revision: { checks: ["positive('results', t.revision)"] },
    },
    extra: [follows('results', 'follows_set', 'result_sets', 'resultSetId')],
  },
  result_subjects: {
    meta: { custom: true },
    extra: [follows('result_subjects', 'follows_result', 'results', 'resultId', { and: 'not p.is_withheld' })],
  },
  // A guardian reads the finished card of a published result that is not withheld, and acknowledges it.
  report_cards: {
    meta: {
      custom: true,
      familyRule: { read: { status: 'generated' }, update: { status: 'generated' } },
    },
    columns: { revision: { checks: ["positive('report_cards', t.revision)"] } },
    extra: [
      follows('report_cards', 'follows_result', 'results', 'resultId', { for: 'all', and: 'not p.is_withheld' }),
    ],
  },
  // The names of the areas label a child's scores, so members read them.
  co_scholastic_areas: { meta: { member: 'read' } },
  co_scholastic_scores: {
    meta: { custom: true },
    extra: [follows('co_scholastic_scores', 'follows_set', 'result_sets', 'resultSetId')],
  },

  // ------------------------------------------------------------------ M20 · Behaviour and houses

  houses: {
    meta: { member: 'read' },
    columns: {
      colour: { checks: [{ suffix: 'hex', sql: "${t.colour} ~ '^#[0-9A-Fa-f]{6}$'" }] },
    },
    fixture: "() => ({ colour: '#1F6F5C' })",
  },
  // A record a family reads names its category, so members read the list of categories.
  behaviour_categories: {
    meta: { member: 'read' },
    columns: {
      default_points: {
        checks: [
          {
            suffix: 'sign',
            sql: "(${t.kind} = 'positive' and ${t.defaultPoints} >= 0) or (${t.kind} = 'negative' and ${t.defaultPoints} <= 0)",
          },
        ],
      },
    },
    fixture: "() => ({ kind: 'positive' })",
  },
  behaviour_records: {
    meta: { familyRule: { read: { status: ['recorded', 'confirmed'], visibility: 'family' } } },
  },
  behaviour_concerns: {
    policy: 'template',
    columns: {
      outcome: {
        checks: [
          {
            suffix: 'needed',
            sql: "${t.status} <> 'closed' or (${t.outcome} is not null and ${t.closedOn} is not null)",
          },
        ],
      },
    },
  },
  concern_actions: {
    meta: { familyRule: { read: { shareWithFamily: true } } },
    columns: {
      to_date: {
        accounted: 'check',
        checks: [{ suffix: 'needed', sql: "${t.action} <> 'suspension' or ${t.toDate} is not null" }],
      },
    },
    fixture: "() => ({ action: 'verbal_warning' })",
  },
  // Families read house totals from the view `house_point_totals`, never the rows: a row names
  // a student and the reason.
  house_points: {
    policy: 'template',
    sql: [
      `create view house_point_totals with (security_barrier = true) as
  select org_id, branch_id, house_id, academic_year_id, sum(points)::int as points
  from house_points
  where org_id = (select app.org_id())
  group by org_id, branch_id, house_id, academic_year_id`,
      'revoke all on house_point_totals from public, anon, authenticated',
      'grant select on house_point_totals to authenticated',
      "comment on view house_point_totals is 'The points each house holds in a school year. What a family may see of house points: the totals, never who was given them or why.'",
    ],
  },
  // Only the counsellor who wrote a note, and holders of the `counselling` capability, reach it.
  counselling_notes: { policy: 'template', meta: { capOwner: 'counsellorStaffId' } },
};
