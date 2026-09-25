/**
 * Adds soft deletion. Deleted documents are hidden from find/count queries unless
 * the query is run with `.setOptions({ withDeleted: true })`.
 */
module.exports = function softDelete(schema) {
  schema.add({
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: 'ObjectId', ref: 'User', default: null },
  });

  const hideDeleted = function hideDeleted() {
    if (this.getOptions().withDeleted) return;
    const filter = this.getFilter();
    if (!('deletedAt' in filter)) this.where({ deletedAt: null });
  };

  ['find', 'findOne', 'findOneAndUpdate', 'countDocuments', 'updateOne', 'updateMany'].forEach((hook) =>
    schema.pre(hook, hideDeleted)
  );

  schema.pre('aggregate', function hideDeletedAggregate() {
    if (this.options?.withDeleted) return;
    this.pipeline().unshift({ $match: { deletedAt: null } });
  });

  schema.methods.softDelete = function markDeleted(userId, session) {
    this.deletedAt = new Date();
    this.deletedBy = userId || null;
    return this.save({ session });
  };
};
