const { validateSummerCourtDateTime } = require("./summer-court-calendar");

const STAGED_WHISPER_IMPORTS = new Map();

function getNow() {
  return new Date().toISOString();
}

function normalizeString(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed ? trimmed : null;
}

function toOptionalNonNegativeInt(value, fieldName, issues) {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 0) {
    issues.push(`${fieldName} must be a non-negative integer`);
    return 0;
  }

  return parsed;
}

function parseSummerCourtInput(payload = {}, issues) {
  const hasAnyField =
    payload.crown_year !== undefined ||
    payload.bloom_index !== undefined ||
    payload.petal !== undefined ||
    payload.bell !== undefined ||
    payload.chime !== undefined;

  if (!hasAnyField) {
    return {
      crown_year: null,
      bloom_index: null,
      petal: null,
      bell: null,
      chime: null,
    };
  }

  const parsed = {
    crown_year: Number.parseInt(String(payload.crown_year ?? ""), 10),
    bloom_index: Number.parseInt(String(payload.bloom_index ?? ""), 10),
    petal: Number.parseInt(String(payload.petal ?? ""), 10),
    bell: Number.parseInt(String(payload.bell ?? ""), 10),
    chime: Number.parseInt(String(payload.chime ?? ""), 10),
  };

  const dateIssues = validateSummerCourtDateTime(parsed);
  for (const issue of dateIssues) {
    issues.push(issue);
  }

  if (dateIssues.length > 0) {
    return {
      crown_year: null,
      bloom_index: null,
      petal: null,
      bell: null,
      chime: null,
    };
  }

  return parsed;
}

function getStage(dmUserId) {
  if (!STAGED_WHISPER_IMPORTS.has(dmUserId)) {
    STAGED_WHISPER_IMPORTS.set(dmUserId, {
      files: [],
      createdAt: getNow(),
      updatedAt: getNow(),
    });
  }

  return STAGED_WHISPER_IMPORTS.get(dmUserId);
}

function clearStage(dmUserId) {
  STAGED_WHISPER_IMPORTS.set(dmUserId, {
    files: [],
    createdAt: getNow(),
    updatedAt: getNow(),
  });

  return STAGED_WHISPER_IMPORTS.get(dmUserId);
}

function addStagedFile(dmUserId, file) {
  const stage = getStage(dmUserId);
  if (!file) {
    return stage;
  }

  const filename = String(file.originalname || "");
  if (!filename.toLowerCase().endsWith(".json")) {
    return stage;
  }

  stage.files.push({
    filename,
    content: String(file.buffer || Buffer.from("")).toString("utf8"),
    size: Number(file.size || 0),
    uploadedAt: getNow(),
  });
  stage.updatedAt = getNow();
  return stage;
}

function classifyFileResult({ createdCount, updatedCount, invalidCount }) {
  if (createdCount === 0 && updatedCount === 0) {
    return "invalid";
  }
  if (createdCount > 0 && updatedCount > 0) {
    return "updated";
  }
  if (createdCount > 0) {
    return "created";
  }
  if (updatedCount > 0 && invalidCount === 0) {
    return "updated";
  }
  return "invalid";
}

function buildImportPreview(db, dmUserId) {
  const stage = getStage(dmUserId);
  const postExistingByImportKey = db
    .prepare(
      `
        SELECT import_key
        FROM whisper_posts
        WHERE import_key IS NOT NULL
      `
    )
    .all();
  const existingPostKeys = new Set(postExistingByImportKey.map((row) => row.import_key));

  const commentExistingByImportKey = db
    .prepare(
      `
        SELECT import_key
        FROM whisper_comments
        WHERE import_key IS NOT NULL
      `
    )
    .all();
  const existingCommentKeys = new Set(commentExistingByImportKey.map((row) => row.import_key));

  const files = [];
  const totals = { create: 0, update: 0, invalid: 0, warnings: 0 };

  for (const stagedFile of stage.files) {
    const fileValidationIssues = [];
    const fileWarnings = [];
    const postRows = [];
    let parsed;

    try {
      parsed = JSON.parse(stagedFile.content || "{}");
    } catch (_error) {
      parsed = null;
      fileValidationIssues.push("File is not valid JSON");
    }

    const schemaVersion = Number(parsed?.schema_version);
    const sourceLabel = normalizeString(parsed?.source_label) || stagedFile.filename;
    const mode = normalizeString(parsed?.mode);

    if (parsed) {
      if (schemaVersion !== 1) {
        fileValidationIssues.push("schema_version must equal 1");
      }
      if (mode !== "upsert") {
        fileValidationIssues.push("mode must equal 'upsert'");
      }
      if (!Array.isArray(parsed.posts)) {
        fileValidationIssues.push("posts must be an array");
      }
      if (!normalizeString(parsed.source_label)) {
        fileWarnings.push("source_label missing; using filename as source label");
      }
    }

    const seenPostKeys = new Set();
    const seenCommentKeys = new Set();

    if (parsed && Array.isArray(parsed.posts)) {
      parsed.posts.forEach((rawPost, postIndex) => {
        const postIssues = [];
        const postWarnings = [];
        const postKey = normalizeString(rawPost?.post_key);
        const title = normalizeString(rawPost?.title);
        const body = normalizeString(rawPost?.body);

        if (!postKey) {
          postIssues.push("post_key is required");
        }
        if (!title) {
          postIssues.push("title is required");
        }
        if (!body) {
          postIssues.push("body is required");
        }

        if (postKey) {
          if (seenPostKeys.has(postKey)) {
            postIssues.push("Duplicate post_key in file");
          }
          seenPostKeys.add(postKey);
        }

        const likeCount = toOptionalNonNegativeInt(rawPost?.like_count, "like_count", postIssues);
        const viewCount = toOptionalNonNegativeInt(rawPost?.view_count, "view_count", postIssues);
        const postTimestamp = parseSummerCourtInput(rawPost || {}, postIssues);

        const comments = Array.isArray(rawPost?.comments) ? rawPost.comments : [];
        if (rawPost?.comments !== undefined && !Array.isArray(rawPost?.comments)) {
          postWarnings.push("comments should be an array; treating as empty");
        }

        const commentRows = comments.map((rawComment, commentIndex) => {
          const commentIssues = [];
          const commentWarnings = [];
          const commentKey = normalizeString(rawComment?.comment_key);
          const commentBody = normalizeString(rawComment?.body);

          if (!commentKey) {
            commentIssues.push("comment_key is required");
          }
          if (!commentBody) {
            commentIssues.push("body is required");
          }

          if (commentKey) {
            if (seenCommentKeys.has(commentKey)) {
              commentIssues.push("Duplicate comment_key in file");
            }
            seenCommentKeys.add(commentKey);
          }

          const commentTimestamp = parseSummerCourtInput(rawComment || {}, commentIssues);
          const status = commentKey
            ? existingCommentKeys.has(commentKey)
              ? "update"
              : "create"
            : null;

          return {
            index: commentIndex,
            comment_key: commentKey,
            body: commentBody,
            status,
            validation_issues: commentIssues,
            warnings: commentWarnings,
            timestamp: commentTimestamp,
          };
        });

        const status = postKey ? (existingPostKeys.has(postKey) ? "update" : "create") : null;
        const invalidCommentsCount = commentRows.filter((row) => row.validation_issues.length > 0).length;

        postRows.push({
          index: postIndex,
          title,
          post_key: postKey,
          body,
          like_count: likeCount,
          view_count: viewCount,
          status,
          validation_issues: postIssues,
          warnings: postWarnings,
          timestamp: postTimestamp,
          comments: commentRows,
          comment_count: commentRows.length,
          invalid_comment_count: invalidCommentsCount,
        });
      });
    }

    const counts = {
      create: postRows.filter((post) => post.status === "create" && post.validation_issues.length === 0).length,
      update: postRows.filter((post) => post.status === "update" && post.validation_issues.length === 0).length,
      invalid: postRows.filter((post) => post.validation_issues.length > 0).length,
    };

    totals.create += counts.create;
    totals.update += counts.update;
    totals.invalid += counts.invalid + (fileValidationIssues.length ? 1 : 0);
    totals.warnings += fileWarnings.length + postRows.reduce((acc, post) => acc + post.warnings.length, 0);

    files.push({
      filename: stagedFile.filename,
      size: stagedFile.size,
      uploaded_at: stagedFile.uploadedAt,
      source_label: sourceLabel,
      mode: mode || null,
      schema_version: Number.isFinite(schemaVersion) ? schemaVersion : null,
      validation_issues: fileValidationIssues,
      warnings: fileWarnings,
      summary: {
        create: counts.create,
        update: counts.update,
        invalid: counts.invalid,
        posts: postRows.length,
      },
      posts: postRows.map((post) => ({
        title: post.title,
        post_key: post.post_key,
        status: post.status,
        timestamp: post.timestamp,
        comment_count: post.comment_count,
        invalid_comment_count: post.invalid_comment_count,
        validation_issues: post.validation_issues,
        warnings: post.warnings,
        comments: post.comments.map((comment) => ({
          comment_key: comment.comment_key,
          status: comment.status,
          validation_issues: comment.validation_issues,
          warnings: comment.warnings,
        })),
      })),
      internal: {
        source_label: sourceLabel,
        postRows,
      },
    });
  }

  return {
    staged_file_count: stage.files.length,
    totals,
    files,
  };
}

async function finalizeImport(db, dmUserId) {
  const preview = buildImportPreview(db, dmUserId);
  const now = getNow();
  const results = [];

  const selectPostByImportKey = db.prepare(
    `
      SELECT id
      FROM whisper_posts
      WHERE import_key = ?
    `
  );
  const selectCommentByImportKey = db.prepare(
    `
      SELECT id
      FROM whisper_comments
      WHERE import_key = ?
    `
  );

  const insertPost = db.prepare(
    `
      INSERT INTO whisper_posts (
        author_user_id,
        title,
        body,
        like_count,
        view_count,
        crown_year,
        bloom_index,
        petal,
        bell,
        chime,
        import_key,
        source_label,
        last_imported_at,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  );
  const updatePost = db.prepare(
    `
      UPDATE whisper_posts
      SET author_user_id = ?,
          title = ?,
          body = ?,
          like_count = ?,
          view_count = ?,
          crown_year = ?,
          bloom_index = ?,
          petal = ?,
          bell = ?,
          chime = ?,
          source_label = ?,
          last_imported_at = ?,
          updated_at = ?
      WHERE id = ?
    `
  );

  const insertComment = db.prepare(
    `
      INSERT INTO whisper_comments (
        post_id,
        author_user_id,
        body,
        crown_year,
        bloom_index,
        petal,
        bell,
        chime,
        import_key,
        source_label,
        last_imported_at,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  );
  const updateComment = db.prepare(
    `
      UPDATE whisper_comments
      SET post_id = ?,
          author_user_id = ?,
          body = ?,
          crown_year = ?,
          bloom_index = ?,
          petal = ?,
          bell = ?,
          chime = ?,
          source_label = ?,
          last_imported_at = ?,
          updated_at = ?
      WHERE id = ?
    `
  );

  const insertImportLog = db.prepare(
    `
      INSERT INTO import_logs (dm_user_id, filename, result, message, created_at)
      VALUES (?, ?, ?, ?, ?)
    `
  );

  const tx = db.transaction(() => {
    for (const file of preview.files) {
      let createdCount = 0;
      let updatedCount = 0;
      let invalidCount = 0;

      if (file.validation_issues.length > 0) {
        invalidCount += 1;
      }

      for (const post of file.internal.postRows) {
        if (post.validation_issues.length > 0 || !post.post_key || !post.title || !post.body) {
          invalidCount += 1;
          continue;
        }

        const existingPost = selectPostByImportKey.get(post.post_key);
        let postId;

        if (existingPost) {
          postId = Number(existingPost.id);
          updatePost.run(
            dmUserId,
            post.title,
            post.body,
            post.like_count,
            post.view_count,
            post.timestamp.crown_year,
            post.timestamp.bloom_index,
            post.timestamp.petal,
            post.timestamp.bell,
            post.timestamp.chime,
            file.internal.source_label,
            now,
            now,
            postId
          );
          updatedCount += 1;
        } else {
          const insertedPost = insertPost.run(
            dmUserId,
            post.title,
            post.body,
            post.like_count,
            post.view_count,
            post.timestamp.crown_year,
            post.timestamp.bloom_index,
            post.timestamp.petal,
            post.timestamp.bell,
            post.timestamp.chime,
            post.post_key,
            file.internal.source_label,
            now,
            now,
            now
          );
          postId = Number(insertedPost.lastInsertRowid);
          createdCount += 1;
        }

        for (const comment of post.comments) {
          if (comment.validation_issues.length > 0 || !comment.comment_key || !comment.body) {
            invalidCount += 1;
            continue;
          }

          const existingComment = selectCommentByImportKey.get(comment.comment_key);
          if (existingComment) {
            updateComment.run(
              postId,
              dmUserId,
              comment.body,
              comment.timestamp.crown_year,
              comment.timestamp.bloom_index,
              comment.timestamp.petal,
              comment.timestamp.bell,
              comment.timestamp.chime,
              file.internal.source_label,
              now,
              now,
              Number(existingComment.id)
            );
          } else {
            insertComment.run(
              postId,
              dmUserId,
              comment.body,
              comment.timestamp.crown_year,
              comment.timestamp.bloom_index,
              comment.timestamp.petal,
              comment.timestamp.bell,
              comment.timestamp.chime,
              comment.comment_key,
              file.internal.source_label,
              now,
              now,
              now
            );
          }
        }
      }

      const result = classifyFileResult({ createdCount, updatedCount, invalidCount });
      const message = `Whisper import created ${createdCount}, updated ${updatedCount}, invalid ${invalidCount}`;
      insertImportLog.run(dmUserId, file.filename, result, message, now);

      results.push({
        filename: file.filename,
        result,
        created: createdCount,
        updated: updatedCount,
        invalid: invalidCount,
      });
    }
  });

  tx();
  clearStage(dmUserId);

  return {
    finalized_at: now,
    results,
  };
}

function getStagingSummary(db, dmUserId) {
  const preview = buildImportPreview(db, dmUserId);
  return {
    staged_file_count: preview.staged_file_count,
    totals: preview.totals,
    files: preview.files.map((file) => ({
      filename: file.filename,
      size: file.size,
      uploaded_at: file.uploaded_at,
      source_label: file.source_label,
      mode: file.mode,
      schema_version: file.schema_version,
      validation_issues: file.validation_issues,
      warnings: file.warnings,
      summary: file.summary,
      posts: file.posts,
    })),
  };
}

module.exports = {
  addStagedFile,
  clearStage,
  finalizeImport,
  getStagingSummary,
};
