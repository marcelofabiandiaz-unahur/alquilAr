function mockFindByIdQuery(doc) {
  const query = {
    populate() { return query; },
    then(resolve) { resolve(doc); },
  };
  return query;
}

module.exports = { mockFindByIdQuery };
