import { schemaComposer } from 'graphql-compose';
import { graphql, GraphQLSchema } from 'graphql-compose/lib/graphql';
import { UserModel } from '../__mocks__/userModel';
import { composeWithMongoose } from '../index';

beforeAll(() => UserModel.base.createConnection());
afterAll(() => UserModel.base.disconnect());

describe('integration tests', () => {
  beforeEach(() => {
    schemaComposer.clear();
  });

  describe('check sub-documents', () => {
    it('should return subDoc fields even subDoc is empty itself', async () => {
      const UserTC = composeWithMongoose(UserModel);
      schemaComposer.Query.addFields({
        user: UserTC.getResolver('findById'),
      });
      const schema = schemaComposer.buildSchema();

      const user = new UserModel({
        name: 'Test empty subDoc',
        contacts: { email: 'mail' },
      });
      await user.save();
      const result: any = await graphql(
        schema,
        `{
        user(_id: "${user._id}") {
          name
          subDoc {
            field1
            field2 {
              field21
            }
          }
        }
      }`
      );

      expect(result.data.user).toEqual({
        name: 'Test empty subDoc',
        subDoc: {
          field1: null,
          field2: { field21: null },
        },
      });
    });

    it('should return subDoc fields if it is non-empty', async () => {
      const UserTC = composeWithMongoose(UserModel);
      // UserTC.get('$findById.subDoc').extendField('field2', {
      //   resolve: (source) => {
      //     console.log('$findById.subDoc.field2 source:', source)
      //     return source.field2;
      //   }
      // })
      schemaComposer.Query.addFields({
        user: UserTC.getResolver('findById'),
      });
      const schema = schemaComposer.buildSchema();

      const user2 = new UserModel({
        name: 'Test non empty subDoc',
        contacts: { email: 'mail' },
        subDoc: { field2: { field21: 'ok' } },
      });
      await user2.save();
      const result2: any = await graphql(
        schema,
        `{
        user(_id: "${user2._id}") {
          name
          subDoc {
            field1
            field2 {
              field21
            }
          }
        }
      }`
      );

      expect(result2.data.user).toEqual({
        name: 'Test non empty subDoc',
        subDoc: {
          field1: null,
          field2: { field21: 'ok' },
        },
      });
    });
  });

  describe('check mixed field', () => {
    it('should properly return data via graphql query', async () => {
      const UserTC = composeWithMongoose(UserModel, { schemaComposer });
      const user = new UserModel({
        name: 'nodkz',
        contacts: { email: 'mail' },
        someDynamic: {
          a: 123,
          b: [1, 2, true, false, 'ok'],
          c: { c: 1 },
          d: null,
          e: 'str',
          f: true,
          g: false,
        },
      });
      await user.save();

      schemaComposer.Query.addFields({
        user: UserTC.getResolver('findById'),
      });
      const schema = schemaComposer.buildSchema();

      const query = `{
        user(_id: "${user._id}") {
          name
          someDynamic
        }
      }`;
      const result: any = await graphql(schema, query);
      expect(result.data.user.name).toBe(user.name);
      expect(result.data.user.someDynamic).toEqual(user.someDynamic);
    });
  });

  describe('projection', () => {
    let schema: GraphQLSchema;
    let UserTC;
    beforeAll(async () => {
      schemaComposer.clear();
      UserTC = composeWithMongoose(UserModel);
      UserTC.addFields({
        rawData: {
          type: 'JSON',
          resolve: (source: any) => source.toJSON(),
          projection: { '*': true },
        },
      });
      schemaComposer.Query.addFields({
        user: UserTC.getResolver('findById'),
      });
      schema = schemaComposer.buildSchema();
      await UserModel.create({
        _id: '100000000000000000000000',
        name: 'Name',
        age: 20,
        gender: 'male',
        skills: ['a', 'b', 'c'],
        relocation: true,
        contacts: { email: 'mail' },
      });
    });

    it('should request only fields from query', async () => {
      const res = await graphql(schema, '{ user(_id: "100000000000000000000000") { name } }');
      expect(res).toMatchSnapshot('projection from query fields');
    });

    it('should request all fields to rawData field', async () => {
      const res: any = await graphql(
        schema,
        '{ user(_id: "100000000000000000000000") { rawData } }'
      );
      expect(Object.keys(res.data.user.rawData).sort()).toMatchSnapshot(
        'projection from all fields'
      );
    });
  });
});
