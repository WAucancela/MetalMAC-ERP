const noop = () => ({});
module.exports = {
  getFirestore: noop, collection: noop, doc: noop, getDoc: noop, getDocs: noop,
  addDoc: noop, setDoc: noop, updateDoc: noop, deleteDoc: noop,
  query: noop, where: noop, orderBy: noop, limit: noop, startAfter: noop,
  runTransaction: noop, serverTimestamp: () => ({ seconds: 0, nanoseconds: 0 }),
  Timestamp: { now: () => ({ seconds: 0, nanoseconds: 0 }), fromDate: (d) => ({ seconds: Math.floor(d.getTime()/1000), nanoseconds: 0 }) },
};
