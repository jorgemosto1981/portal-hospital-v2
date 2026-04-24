export function StatusSection({ projectId, authAppName, user, userPending, firestoreMsg }) {
  return (
    <section className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="mb-3 text-xl font-semibold text-slate-800">Estado</h2>
      <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-base">
        <dt className="font-semibold text-slate-600">Proyecto</dt>
        <dd className="break-words text-slate-800">
          <code className="text-sm">{projectId}</code>
        </dd>
        <dt className="font-semibold text-slate-600">Auth app</dt>
        <dd>
          <code className="text-sm">{authAppName}</code>
        </dd>
        <dt className="font-semibold text-slate-600">Sesión</dt>
        <dd className="text-slate-800">
          {userPending ? (
            "…"
          ) : user ? (
            <>
              <code className="text-sm">{user.uid}</code>
              {user.email ? (
                <>
                  {" "}
                  · <code className="text-sm">{user.email}</code>
                </>
              ) : null}
            </>
          ) : (
            "Sin sesión"
          )}
        </dd>
        <dt className="font-semibold text-slate-600">Firestore</dt>
        <dd className="text-slate-800">{firestoreMsg}</dd>
      </dl>
    </section>
  );
}
